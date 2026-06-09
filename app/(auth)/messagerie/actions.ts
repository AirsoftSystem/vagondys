
"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { GitHubDB } from "@/lib/github-db/client";

// ==========================================================
// TYPES DÉDIÉS
// ==========================================================

// Types exportés pour le frontend
export interface Conversation {
  dossier_ref: string;
  last_message: string;
  last_message_date: string;
  participant_name: string;
  participant_email: string;
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
  dossierRef: string;
  content: string;
  userId: string;
  userEmail: string;
  fileUrl?: string;
  fileKey?: string;
}

// Interface pour un compte messagerie
interface MessagerieAccount {
  dossier_ref: string;
  email: string;
  full_name: string;
  created_at: string;
}

// Interface pour un message GitHub (sans conversation_id)
interface GitHubMessage {
  id: string;
  dossier_ref: string;
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
 * ✅ CORRECTION : Lecture depuis messagerie_accounts (pas messagerie_conversations)
 * Une conversation = un dossier_ref associé à l'utilisateur
 */
export async function getUserConversations(userEmail: string): Promise<Conversation[]> {
  try {
    // Récupérer tous les dossiers associés à cet email
    const { data: accounts, error } = await supabase
      .from("messagerie_accounts")
      .select("dossier_ref, email, full_name, created_at")
      .eq("email", userEmail.toLowerCase());

    if (error) {
      console.error("Erreur récupération comptes messagerie:", error);
      return [];
    }

    if (!accounts || accounts.length === 0) {
      return [];
    }

    // Pour chaque dossier, récupérer le dernier message depuis GitHub
    const conversations: Conversation[] = await Promise.all(
      accounts.map(async (account: MessagerieAccount) => {
        let lastMessage = "";
        let lastMessageDate = account.created_at;
        
        try {
          const messages = await getMessagesFromGitHub(account.dossier_ref);
          if (messages.length > 0) {
            // Trier par date décroissante pour prendre le dernier
            const sorted = [...messages].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            lastMessage = sorted[0].content.substring(0, 100);
            lastMessageDate = sorted[0].created_at;
          }
        } catch (err) {
          console.error(`Erreur lecture messages pour ${account.dossier_ref}:`, err);
        }

        return {
          dossier_ref: account.dossier_ref,
          last_message: lastMessage || "Aucun message",
          last_message_date: lastMessageDate,
          participant_name: account.full_name,
          participant_email: account.email,
          unread_count: 0, // Pas de comptage des non lus (tout est dans GitHub)
          created_at: account.created_at,
        };
      })
    );

    // Trier par date du dernier message (décroissant)
    conversations.sort(
      (a, b) => new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
    );

    return conversations;
  } catch (err) {
    console.error("Erreur getUserConversations:", err);
    return [];
  }
}

/**
 * Récupère tous les messages d'une conversation spécifique
 * ✅ CORRECTION : Utilisation directe de dossierRef (pas conversationId)
 */
export async function getConversationMessages(
  dossierRef: string,
  userEmail: string
): Promise<Message[]> {
  try {
    // 1. Vérifier que l’utilisateur a accès à ce dossier
    const isStaff = userEmail.endsWith("@vagondys.com");
    
    let hasAccess = false;
    
    if (isStaff) {
      // Le staff a accès à tous les dossiers
      hasAccess = true;
    } else {
      // Vérifier que le dossier appartient bien à l'utilisateur
      const { data: account, error: accountError } = await supabase
        .from("messagerie_accounts")
        .select("dossier_ref")
        .eq("email", userEmail.toLowerCase())
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error("Erreur vérification accès:", accountError);
      }

      hasAccess = !!account;
    }

    if (!hasAccess) {
      console.error(`Accès non autorisé au dossier ${dossierRef} pour ${userEmail}`);
      return [];
    }

    // 2. Lire les messages depuis GITHUB
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
 * ✅ CORRECTION : Utilisation directe de dossierRef (pas conversationId)
 * ✅ CORRECTION : Plus de mise à jour de messagerie_conversations
 */
export async function sendMessage(params: SendMessageParams): Promise<{ success: boolean; error?: string }> {
  const { dossierRef, content, userId, userEmail, fileUrl, fileKey } = params;

  if (!dossierRef || !content || !userId || !userEmail) {
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    // 1. Vérifier que l’utilisateur a accès à ce dossier
    const isStaff = userEmail.endsWith("@vagondys.com");
    
    let hasAccess = false;
    let participantName = "";
    
    if (isStaff) {
      // Le staff a accès à tous les dossiers
      hasAccess = true;
      
      // Récupérer le nom du participant pour l'affichage
      const { data: account } = await supabase
        .from("messagerie_accounts")
        .select("full_name")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      
      if (account) {
        participantName = account.full_name;
      } else {
        console.error(`Dossier ${dossierRef} non trouvé dans messagerie_accounts`);
        return { success: false, error: "Dossier introuvable" };
      }
    } else {
      // Vérifier que le dossier appartient bien à l'utilisateur
      const { data: account, error: accountError } = await supabase
        .from("messagerie_accounts")
        .select("full_name")
        .eq("email", userEmail.toLowerCase())
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error("Erreur vérification accès:", accountError);
      }

      if (account) {
        hasAccess = true;
        participantName = account.full_name;
      }
    }

    if (!hasAccess) {
      return { success: false, error: "Accès non autorisé" };
    }

    // 2. Préparer le message
    const senderName = isStaff ? `Staff ${userEmail.split("@")[0]}` : participantName;
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const newMessage: GitHubMessage = {
      id: messageId,
      dossier_ref: dossierRef,
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

    // ✅ 4. Plus de mise à jour de messagerie_conversations (table supprimée de l'architecture)
    // Les métadonnées de conversation sont implicites via le dossier_ref

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
