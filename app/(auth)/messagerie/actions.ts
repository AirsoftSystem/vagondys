
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

// Interface pour un message GitHub
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
// FONCTIONS UTILITAIRES GITHUB
// ==========================================================

/**
 * Récupère les messages d'une conversation depuis GitHub
 * @param dossierRef - Référence du dossier (ex: VGD-XXXXXX)
 * @returns Liste des messages ou tableau vide
 */
async function getMessagesFromGitHub(dossierRef: string): Promise<GitHubMessage[]> {
  try {
    const path = `conversations/${dossierRef}/messages.json.gz`;
    const messages = await GitHubDB.read<GitHubMessage[]>(path);
    return messages || [];
  } catch (err) {
    console.error(`Erreur lecture GitHub pour ${dossierRef}:`, err);
    return [];
  }
}

/**
 * Écrit un message dans GitHub
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
 * Utilise la table messagerie_conversations (Supabase - métadonnées)
 * ✅ CORRECTION : unread_count toujours 0 (plus de table messagerie_messages)
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

    // Plus de comptage des messages non lus (plus de table messagerie_messages)
    const conversationsWithUnread = conversations.map((conv: DBConversation) => ({
      id: conv.id,
      dossier_ref: conv.dossier_ref,
      last_message: conv.last_message || "",
      last_message_date: conv.last_message_at || conv.created_at,
      subject: `Conversation avec VAGONDYS`,
      unread_count: 0, // Toujours 0, les messages sont dans GitHub
      created_at: conv.created_at,
    }));

    return conversationsWithUnread;
  } catch (err) {
    console.error("Erreur getUserConversations:", err);
    return [];
  }
}

/**
 * Récupère tous les messages d'une conversation spécifique
 * ✅ CORRECTION : Lecture UNIQUEMENT depuis GitHub (plus de Supabase)
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

    // 2. Lire les messages depuis GITHUB
    const dossierRef = conversation.dossier_ref;
    const gitHubMessages = await getMessagesFromGitHub(dossierRef);

    // 3. Trier par date croissante
    gitHubMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 4. Formater les messages pour le frontend
    const formattedMessages: Message[] = gitHubMessages.map((msg: GitHubMessage) => {
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
 * ✅ CORRECTION : Écriture UNIQUEMENT dans GitHub (plus de Supabase)
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
    const dossierRef = conversation.dossier_ref;
    const senderName = isStaff ? `Staff ${userEmail.split("@")[0]}` : conversation.participant_name;
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const newMessage: GitHubMessage = {
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

    // 3. Écrire UNIQUEMENT dans GitHub
    const success = await addMessageToGitHub(dossierRef, newMessage);

    if (!success) {
      return { success: false, error: "Erreur lors de l’écriture dans GitHub" };
    }

    // 4. Mettre à jour la conversation (last_message, last_message_at) dans Supabase
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
      // Non bloquant
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
 * ❌ SUPPRIMÉ : Plus de table messagerie_messages dans Supabase
 * Les messages sont en lecture seule dans GitHub
 */
// Cette fonction n'est plus nécessaire. Les messages sont toujours "lus" dans GitHub.

/**
 * Vérifie si un utilisateur a des messages non lus
 * ❌ SUPPRIMÉ : Plus de table messagerie_messages dans Supabase
 */
// Cette fonction n'est plus nécessaire.

// Note: Les fonctions markConversationAsRead et hasUnreadMessages ont été supprimées
// car elles n'ont plus de sens sans la table messagerie_messages dans Supabase.
