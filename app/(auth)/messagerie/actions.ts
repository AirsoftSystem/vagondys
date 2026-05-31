
"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// ==========================================================
// TYPES DÉDIÉS (sans any)
// ==========================================================

interface SignalPayload {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  city?: string;
  country?: string;
  file_url?: string;
  file_key?: string;
  messages_history?: Array<{
    content: string;
    created_at: string;
    file_url?: string;
    file_key?: string;
  }>;
}

// Types exportés pour le frontend
export interface Conversation {
  id: string;
  dossier_ref: string;
  last_message: string;
  last_message_date: string;
  subject: string;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender: "user" | "staff" | "system";
  sender_name: string;
  document_url?: string | null;
}

export interface SendMessageParams {
  dossier_ref: string;
  content: string;
  userId: string;
  userEmail: string;
  fileUrl?: string;
  fileKey?: string;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Configuration Supabase manquante pour messagerie");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================================
// FONCTIONS
// ==========================================================

/**
 * Récupère toutes les conversations d'un utilisateur
 * Basé sur les pending_signals où l'utilisateur est impliqué
 */
export async function getUserConversations(userEmail: string): Promise<Conversation[]> {
  try {
    const { data: signals, error } = await supabase
      .from("pending_signals")
      .select("id, dossier_ref, payload, created_at, is_read")
      .eq("payload->>email", userEmail.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération conversations:", error);
      return [];
    }

    if (!signals || signals.length === 0) {
      return [];
    }

    const conversations: Conversation[] = signals.map((signal) => {
      const payload = signal.payload as SignalPayload;
      const subject = payload?.subject || "Message";
      
      let lastMessage = payload?.message || "";
      let lastMessageDate = signal.created_at;
      
      if (payload?.messages_history && payload.messages_history.length > 0) {
        const last = payload.messages_history[payload.messages_history.length - 1];
        lastMessage = last.content;
        lastMessageDate = last.created_at;
      }
      
      return {
        id: signal.id,
        dossier_ref: signal.dossier_ref || `MSG-${signal.id.substring(0, 8)}`,
        last_message: lastMessage.substring(0, 100),
        last_message_date: lastMessageDate,
        subject: subject,
        unread_count: signal.is_read ? 0 : 1,
        created_at: signal.created_at,
      };
    });

    return conversations;
  } catch (err) {
    console.error("Erreur getUserConversations:", err);
    return [];
  }
}

/**
 * Récupère tous les messages d'une conversation spécifique
 */
export async function getConversationMessages(
  dossierRef: string,
  userEmail: string
): Promise<Message[]> {
  try {
    const messages: Message[] = [];

    const { data: signal, error: signalError } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .maybeSingle();

    if (signalError || !signal) {
      console.error("Erreur récupération signal:", signalError);
      return [];
    }

    const payload = signal.payload as SignalPayload;
    const userFirstName = userEmail.toLowerCase().split("@")[0];

    // Message initial
    if (payload?.message) {
      messages.push({
        id: `${signal.id}_initial`,
        content: payload.message,
        created_at: signal.created_at,
        sender: "user",
        sender_name: payload?.name?.split(" ")[0] || userFirstName,
        document_url: payload?.file_url || null,
      });
    }

    // Historique des messages client
    if (payload?.messages_history && Array.isArray(payload.messages_history)) {
      for (let i = 0; i < payload.messages_history.length; i++) {
        const msg = payload.messages_history[i];
        messages.push({
          id: `${signal.id}_history_${i}`,
          content: msg.content,
          created_at: msg.created_at,
          sender: "user",
          sender_name: payload?.name?.split(" ")[0] || userFirstName,
          document_url: msg.file_url || null,
        });
      }
    }

    // Réponses staff
    const { data: staffReplies, error: repliesError } = await supabase
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: true });

    if (!repliesError && staffReplies && staffReplies.length > 0) {
      for (const reply of staffReplies) {
        messages.push({
          id: reply.id,
          content: reply.content,
          created_at: reply.created_at,
          sender: "staff",
          sender_name: reply.agent_email?.split("@")[0] || "Staff VAGONDYS",
          document_url: reply.document_url || null,
        });
      }
    }

    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return messages;
  } catch (err) {
    console.error("Erreur getConversationMessages:", err);
    return [];
  }
}

/**
 * Envoie un nouveau message dans une conversation
 */
export async function sendMessage(params: SendMessageParams): Promise<{ success: boolean; error?: string }> {
  const { dossier_ref, content, userId, userEmail, fileUrl, fileKey } = params;

  if (!dossier_ref || !content || !userId || !userEmail) {
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    const { data: existingSignal, error: fetchError } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", dossier_ref)
      .maybeSingle();

    if (fetchError || !existingSignal) {
      return { success: false, error: "Conversation introuvable" };
    }

    const existingPayload = existingSignal.payload as SignalPayload;
    const messagesHistory = existingPayload.messages_history || [];

    const newMessageEntry = {
      content: content,
      created_at: new Date().toISOString(),
      ...(fileUrl && { file_url: fileUrl }),
      ...(fileKey && { file_key: fileKey }),
    };

    messagesHistory.push(newMessageEntry);

    const updatedPayload: SignalPayload = {
      ...existingPayload,
      message: content,
      messages_history: messagesHistory,
      ...(fileUrl && { file_url: fileUrl }),
      ...(fileKey && { file_key: fileKey }),
    };

    const { error: updateError } = await supabase
      .from("pending_signals")
      .update({
        payload: updatedPayload,
        is_read: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSignal.id);

    if (updateError) {
      console.error("Erreur mise à jour signal:", updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath("/messagerie");

    return { success: true };
  } catch (err) {
    console.error("Erreur sendMessage:", err);
    return { success: false, error: "Erreur interne" };
  }
}

/**
 * Marque une conversation comme lue
 */
export async function markConversationAsRead(dossierRef: string): Promise<{ success: boolean }> {
  try {
    const { error } = await supabase
      .from("pending_signals")
      .update({ is_read: true })
      .eq("dossier_ref", dossierRef);

    if (error) {
      console.error("Erreur marquage comme lu:", error);
      return { success: false };
    }

    revalidatePath("/messagerie");
    return { success: true };
  } catch (err) {
    console.error("Erreur markConversationAsRead:", err);
    return { success: false };
  }
}

/**
 * Vérifie si un utilisateur a des messages non lus
 */
export async function hasUnreadMessages(userEmail: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("pending_signals")
      .select("id")
      .eq("payload->>email", userEmail.toLowerCase())
      .eq("is_read", false)
      .limit(1);

    if (error) {
      console.error("Erreur vérification non lus:", error);
      return false;
    }

    return data && data.length > 0;
  } catch (err) {
    console.error("Erreur hasUnreadMessages:", err);
    return false;
  }
}
