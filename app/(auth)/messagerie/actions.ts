
"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { GitHubDB } from "@/lib/github-db/client";

// ==========================================================
// TYPES DÉDIÉS
// ==========================================================

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
  conversationId: string;
  content: string;
  userId: string;
  userEmail: string;
  fileUrl?: string;
  fileKey?: string;
}

// Interface pour une conversation de la base
interface DBConversation {
  id: string;
  dossier_ref: string;
  participant_email: string;
  participant_name: string;
  participant_company: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// Interface pour un message de la base
interface DBMessage {
  id: string;
  conversation_id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  file_url: string | null;
  file_key: string | null;
  is_read: boolean;
  created_at: string;
}

// Interface pour un message GitHub (identique à DBMessage)
interface GitHubMessage {
  id: string;
  conversation_id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  file_url: string | null;
  file_key: string | null;
  is_read: boolean;
  created_at: string;
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
// FONCTION UTILITAIRE : LIRE LES MESSAGES DEPUIS GITHUB
// ==========================================================

/**
 * Récupère les messages d'une conversation depuis GitHub (archive)
 * @param dossierRef - Référence du dossier (ex: VGD-XXXXXX)
 * @returns Liste des messages ou null
 */
async function getMessagesFromGitHub(dossierRef: string): Promise<GitHubMessage[] | null> {
  try {
    const path = `conversations/${dossierRef}/messages.json.gz`;
    const messages = await GitHubDB.read<GitHubMessage[]>(path);
    return messages || null;
  } catch (err) {
    console.error(`Erreur lecture GitHub pour ${dossierRef}:`, err);
    return null;
  }
}

/**
 * Écrit un message dans GitHub (archive)
 * @param dossierRef - Référence du dossier
 * @param message - Message à ajouter
 */
async function addMessageToGitHub(dossierRef: string, message: GitHubMessage): Promise<boolean> {
  try {
    const path = `conversations/${dossierRef}/messages.json.gz`;
    
    // Lire les messages existants
    let existingMessages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(path);
      if (existing) existingMessages = existing;
    } catch {
      // Fichier n'existe pas encore
      existingMessages = [];
    }
    
    // Ajouter le nouveau message
    existingMessages.push(message);
    
    // Écrire dans GitHub (compressé)
    await GitHubDB.write(path, existingMessages, { compress: true });
    console.log(`✅ Message écrit dans GitHub: ${path}`);
    return true;
  } catch (err) {
    console.error(`Erreur écriture GitHub pour ${dossierRef}:`, err);
    return false;
  }
}

// ==========================================================
// FONCTIONS PRINCIPALES
// ==========================================================

/**
 * Récupère toutes les conversations d'un utilisateur
 * Utilise la nouvelle table messagerie_conversations
 */
export async function getUserConversations(userEmail: string): Promise<Conversation[]> {
  try {
    const { data: conversations, error } = await supabase
      .from("messagerie_conversations")
      .select("*")
      .eq("participant_email", userEmail.toLowerCase())
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération conversations:", error);
      return [];
    }

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Pour chaque conversation, compter les messages non lus
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv: DBConversation) => {
        // Compter les messages non lus où l’utilisateur n’est pas l’expéditeur
        const { count: unreadCount, error: countError } = await supabase
          .from("messagerie_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_email", userEmail.toLowerCase());

        if (countError) {
          console.error("Erreur comptage messages non lus:", countError);
        }

        return {
          id: conv.id,
          dossier_ref: conv.dossier_ref,
          last_message: conv.last_message || "",
          last_message_date: conv.last_message_at || conv.created_at,
          subject: `Conversation avec VAGONDYS`,
          unread_count: unreadCount || 0,
          created_at: conv.created_at,
        };
      })
    );

    return conversationsWithUnread;
  } catch (err) {
    console.error("Erreur getUserConversations:", err);
    return [];
  }
}

/**
 * Récupère tous les messages d'une conversation spécifique
 * ✅ MODIFICATION : Fallback vers GitHub si Supabase est vide ou incomplet
 */
export async function getConversationMessages(
  conversationId: string,
  userEmail: string
): Promise<Message[]> {
  try {
    // 1. Vérifier que l’utilisateur a accès à cette conversation
    const { data: conversation, error: convError } = await supabase
      .from("messagerie_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("Conversation introuvable:", convError);
      return [];
    }

    const isStaff = userEmail.endsWith("@vagondys.com");
    const hasAccess = isStaff || conversation.participant_email === userEmail.toLowerCase();

    if (!hasAccess) {
      console.error("Accès non autorisé à la conversation");
      return [];
    }

    // 2. Récupérer les messages depuis Supabase
    let supabaseMessages: DBMessage[] = [];
    
    try {
      const { data: messages, error: messagesError } = await supabase
        .from("messagerie_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!messagesError && messages) {
        supabaseMessages = messages as DBMessage[];
      }
    } catch (err) {
      console.warn("Erreur lecture Supabase, fallback vers GitHub:", err);
    }

    // 3. Si Supabase a peu ou pas de messages, tenter GitHub
    const allMessages: DBMessage[] = [...supabaseMessages];
    
    if (supabaseMessages.length === 0 || supabaseMessages.length < 5) {
      const gitHubMessages = await getMessagesFromGitHub(conversation.dossier_ref);
      if (gitHubMessages && gitHubMessages.length > 0) {
        console.log(`📦 Chargement de ${gitHubMessages.length} messages depuis GitHub pour ${conversation.dossier_ref}`);
        
        // Fusionner les messages (éviter les doublons par id)
        const existingIds = new Set(allMessages.map(m => m.id));
        for (const msg of gitHubMessages) {
          if (!existingIds.has(msg.id)) {
            allMessages.push(msg as DBMessage);
          }
        }
        
        // Trier par date
        allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    }

    // 4. Marquer les messages comme lus (uniquement dans Supabase pour les récents)
    const unreadMessageIds = allMessages
      .filter((msg: DBMessage) => !msg.is_read && msg.sender_email !== userEmail.toLowerCase())
      .map((msg: DBMessage) => msg.id);

    if (unreadMessageIds.length > 0) {
      // Ne marquer comme lus que ceux qui sont dans Supabase (les GitHub sont en lecture seule)
      const supabaseUnreadIds = unreadMessageIds.filter(id => 
        supabaseMessages.some(m => m.id === id)
      );
      
      if (supabaseUnreadIds.length > 0) {
        const { error: updateError } = await supabase
          .from("messagerie_messages")
          .update({ is_read: true })
          .in("id", supabaseUnreadIds);

        if (updateError) {
          console.error("Erreur marquage messages lus:", updateError);
        }
      }
    }

    // 5. Formater les messages pour le frontend
    const formattedMessages: Message[] = allMessages.map((msg: DBMessage) => {
      const isStaffSender = msg.sender_email.endsWith("@vagondys.com") || msg.sender_email === "system@vagondys.com";
      const isSystem = msg.sender_email === "system@vagondys.com";
      
      let sender: "user" | "staff" | "system" = "user";
      if (isSystem) sender = "system";
      else if (isStaffSender) sender = "staff";

      return {
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender: sender,
        sender_name: msg.sender_name,
        document_url: msg.file_url || null,
      };
    });

    return formattedMessages;
  } catch (err) {
    console.error("Erreur getConversationMessages:", err);
    return [];
  }
}

/**
 * Envoie un nouveau message dans une conversation
 * ✅ MODIFICATION : Écriture simultanée dans GitHub pour l'archive
 */
export async function sendMessage(params: SendMessageParams): Promise<{ success: boolean; error?: string }> {
  const { conversationId, content, userId, userEmail, fileUrl, fileKey } = params;

  if (!conversationId || !content || !userId || !userEmail) {
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    // 1. Vérifier que l’utilisateur a accès à cette conversation
    const { data: conversation, error: convError } = await supabase
      .from("messagerie_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("Conversation introuvable:", convError);
      return { success: false, error: "Conversation introuvable" };
    }

    const isStaff = userEmail.endsWith("@vagondys.com");
    const hasAccess = isStaff || conversation.participant_email === userEmail.toLowerCase();

    if (!hasAccess) {
      return { success: false, error: "Accès non autorisé" };
    }

    // 2. Préparer le message
    const senderName = isStaff ? `Staff ${userEmail.split("@")[0]}` : conversation.participant_name;
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const newMessage = {
      id: messageId,
      conversation_id: conversationId,
      sender_email: userEmail.toLowerCase(),
      sender_name: senderName,
      content: content.trim(),
      file_url: fileUrl || null,
      file_key: fileKey || null,
      is_read: false,
      created_at: now,
    };

    // 3. Insérer dans Supabase
    const { error: insertError } = await supabase
      .from("messagerie_messages")
      .insert([newMessage]);

    if (insertError) {
      console.error("Erreur insertion message dans Supabase:", insertError);
      return { success: false, error: insertError.message };
    }

    // ✅ 4. Écrire aussi dans GitHub (archive)
    await addMessageToGitHub(conversation.dossier_ref, newMessage);

    // 5. Mettre à jour la conversation (last_message, last_message_at)
    const { error: updateConvError } = await supabase
      .from("messagerie_conversations")
      .update({
        last_message: content.trim().substring(0, 200),
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", conversationId);

    if (updateConvError) {
      console.error("Erreur mise à jour conversation:", updateConvError);
    }

    revalidatePath("/messagerie");

    return { success: true };
  } catch (err) {
    console.error("Erreur sendMessage:", err);
    return { success: false, error: "Erreur interne" };
  }
}

/**
 * Marque tous les messages d'une conversation comme lus
 */
export async function markConversationAsRead(conversationId: string): Promise<{ success: boolean }> {
  try {
    const { error } = await supabase
      .from("messagerie_messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId);

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
    // Récupérer les conversations de l’utilisateur
    const { data: conversations, error: convError } = await supabase
      .from("messagerie_conversations")
      .select("id")
      .eq("participant_email", userEmail.toLowerCase());

    if (convError || !conversations || conversations.length === 0) {
      return false;
    }

    const conversationIds = conversations.map(c => c.id);

    // Compter les messages non lus où l’utilisateur n’est pas l’expéditeur
    const { count, error: countError } = await supabase
      .from("messagerie_messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .eq("is_read", false)
      .neq("sender_email", userEmail.toLowerCase());

    if (countError) {
      console.error("Erreur vérification non lus:", countError);
      return false;
    }

    return (count || 0) > 0;
  } catch (err) {
    console.error("Erreur hasUnreadMessages:", err);
    return false;
  }
}
