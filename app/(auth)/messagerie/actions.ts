
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
  const startTime = Date.now();
  const path = `conversations/${dossierRef}/messages.json.gz`;
  console.log(`📖 [GitHub] Lecture ${path}`);
  
  try {
    const messages = await GitHubDB.read<GitHubMessage[]>(path);
    const count = messages?.length || 0;
    const duration = Date.now() - startTime;
    console.log(`✅ [GitHub] ${count} messages lus depuis ${path} en ${duration}ms`);
    return messages || [];
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(`⚠️ [GitHub] Lecture échouée pour ${path} en ${duration}ms: ${errorMsg}`);
    return [];
  }
}

/**
 * Écrit un message dans GitHub
 * @param dossierRef - Référence du dossier
 * @param message - Message à ajouter
 */
async function addMessageToGitHub(dossierRef: string, message: GitHubMessage): Promise<boolean> {
  const startTime = Date.now();
  const path = `conversations/${dossierRef}/messages.json.gz`;
  console.log(`💾 [GitHub] Écriture dans ${path}`);
  console.log(`📝 [GitHub] Message: id=${message.id}, sender=${message.sender_email}, content length=${message.content.length}`);
  
  try {
    // Lire les messages existants
    let existingMessages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(path);
      if (existing && Array.isArray(existing)) {
        existingMessages = existing;
        console.log(`📖 [GitHub] ${existingMessages.length} messages existants lus`);
      } else if (existing) {
        console.log(`⚠️ [GitHub] Données existantes non tableau, type: ${typeof existing}`);
        existingMessages = [];
      } else {
        console.log(`ℹ️ [GitHub] Aucun message existant, création du fichier`);
        existingMessages = [];
      }
    } catch (readError) {
      const readErrorMsg = readError instanceof Error ? readError.message : String(readError);
      console.log(`ℹ️ [GitHub] Lecture existante échouée (fichier probablement inexistant): ${readErrorMsg}`);
      existingMessages = [];
    }
    
    // Ajouter le nouveau message
    existingMessages.push(message);
    console.log(`📊 [GitHub] Total messages après ajout: ${existingMessages.length}`);
    
    // Écrire dans GitHub (compressé)
    const writeStartTime = Date.now();
    await GitHubDB.write(path, existingMessages, { compress: true });
    const writeDuration = Date.now() - writeStartTime;
    const totalDuration = Date.now() - startTime;
    
    console.log(`✅ [GitHub] Message écrit dans GitHub en ${writeDuration}ms (total ${totalDuration}ms): ${path}`);
    return true;
    
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    // ✅ Correction : remplacer "any" par un type explicite { status?: number }
    const errorStatus = (err as { status?: number })?.status;
    
    console.error(`❌ [GitHub] Erreur écriture - status: ${errorStatus}, message: ${errorMsg}, durée: ${totalDuration}ms`);
    console.error(`❌ [GitHub] Détail erreur:`, err);
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
  const startTime = Date.now();
  console.log(`👤 [getUserConversations] Début pour ${userEmail}`);
  
  try {
    // Récupérer tous les dossiers associés à cet email
    const { data: accounts, error } = await supabase
      .from("messagerie_accounts")
      .select("dossier_ref, email, full_name, created_at")
      .eq("email", userEmail.toLowerCase());

    if (error) {
      console.error(`❌ [getUserConversations] Erreur récupération comptes:`, error);
      return [];
    }

    if (!accounts || accounts.length === 0) {
      console.log(`ℹ️ [getUserConversations] Aucun compte trouvé pour ${userEmail}`);
      return [];
    }
    
    console.log(`📁 [getUserConversations] ${accounts.length} comptes trouvés pour ${userEmail}`);

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
            console.log(`📬 [getUserConversations] Dernier message pour ${account.dossier_ref}: ${lastMessage.substring(0, 30)}...`);
          }
        } catch (err) {
          console.error(`⚠️ [getUserConversations] Erreur lecture messages pour ${account.dossier_ref}:`, err);
        }

        return {
          dossier_ref: account.dossier_ref,
          last_message: lastMessage || "Aucun message",
          last_message_date: lastMessageDate,
          participant_name: account.full_name,
          participant_email: account.email,
          unread_count: 0,
          created_at: account.created_at,
        };
      })
    );

    // Trier par date du dernier message (décroissant)
    conversations.sort(
      (a, b) => new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
    );

    const duration = Date.now() - startTime;
    console.log(`✅ [getUserConversations] ${conversations.length} conversations retournées en ${duration}ms`);
    return conversations;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getUserConversations] Erreur après ${duration}ms:`, err);
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
  const startTime = Date.now();
  console.log(`💬 [getConversationMessages] Début pour dossier ${dossierRef}, user ${userEmail}`);
  
  try {
    // 1. Vérifier que l’utilisateur a accès à ce dossier
    const isStaff = userEmail.endsWith("@vagondys.com");
    
    let hasAccess = false;
    
    if (isStaff) {
      hasAccess = true;
      console.log(`🔓 [getConversationMessages] Staff - accès automatique au dossier ${dossierRef}`);
    } else {
      const { data: account, error: accountError } = await supabase
        .from("messagerie_accounts")
        .select("dossier_ref")
        .eq("email", userEmail.toLowerCase())
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error(`⚠️ [getConversationMessages] Erreur vérification accès:`, accountError);
      }

      hasAccess = !!account;
      if (hasAccess) {
        console.log(`✅ [getConversationMessages] Accès validé pour ${userEmail} sur ${dossierRef}`);
      } else {
        console.log(`❌ [getConversationMessages] Accès refusé pour ${userEmail} sur ${dossierRef}`);
      }
    }

    if (!hasAccess) {
      console.error(`❌ [getConversationMessages] Accès non autorisé au dossier ${dossierRef} pour ${userEmail}`);
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

    const duration = Date.now() - startTime;
    console.log(`✅ [getConversationMessages] ${formattedMessages.length} messages retournés pour ${dossierRef} en ${duration}ms`);
    return formattedMessages;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getConversationMessages] Erreur après ${duration}ms:`, err);
    return [];
  }
}

/**
 * Envoie un nouveau message dans une conversation
 * ✅ CORRECTION : Utilisation directe de dossierRef (pas conversationId)
 * ✅ CORRECTION : Plus de mise à jour de messagerie_conversations
 */
export async function sendMessage(params: SendMessageParams): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const { dossierRef, content, userId, userEmail, fileUrl, fileKey } = params;

  console.log(`📤 [sendMessage] Début - dossier: ${dossierRef}, user: ${userEmail}, content length: ${content?.length || 0}, hasFile: ${!!fileUrl}`);

  if (!dossierRef || !content || !userId || !userEmail) {
    console.error(`❌ [sendMessage] Paramètres manquants - dossierRef: ${!!dossierRef}, content: ${!!content}, userId: ${!!userId}, userEmail: ${!!userEmail}`);
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    // 1. Vérifier que l’utilisateur a accès à ce dossier
    const isStaff = userEmail.endsWith("@vagondys.com");
    console.log(`🔍 [sendMessage] isStaff: ${isStaff}`);
    
    let hasAccess = false;
    let participantName = "";
    
    if (isStaff) {
      // Le staff a accès à tous les dossiers
      hasAccess = true;
      console.log(`🔓 [sendMessage] Staff - accès automatique au dossier ${dossierRef}`);
      
      // Récupérer le nom du participant pour l'affichage
      const { data: account, error: accountError } = await supabase
        .from("messagerie_accounts")
        .select("full_name")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      
      if (accountError) {
        console.error(`⚠️ [sendMessage] Erreur récupération compte:`, accountError);
      }
      
      if (account) {
        participantName = account.full_name;
        console.log(`👤 [sendMessage] Participant trouvé: ${participantName}`);
      } else {
        console.error(`❌ [sendMessage] Dossier ${dossierRef} non trouvé dans messagerie_accounts`);
        return { success: false, error: "Dossier introuvable" };
      }
    } else {
      // Vérifier que le dossier appartient bien à l'utilisateur
      console.log(`🔍 [sendMessage] Vérification accès partenaire pour ${userEmail} sur ${dossierRef}`);
      
      const { data: account, error: accountError } = await supabase
        .from("messagerie_accounts")
        .select("full_name")
        .eq("email", userEmail.toLowerCase())
        .eq("dossier_ref", dossierRef)
        .maybeSingle();

      if (accountError) {
        console.error(`⚠️ [sendMessage] Erreur vérification accès:`, accountError);
      }

      if (account) {
        hasAccess = true;
        participantName = account.full_name;
        console.log(`✅ [sendMessage] Accès partenaire validé pour ${dossierRef}, nom: ${participantName}`);
      } else {
        console.log(`❌ [sendMessage] Aucun compte trouvé pour ${userEmail} avec dossier ${dossierRef}`);
      }
    }

    if (!hasAccess) {
      console.error(`❌ [sendMessage] Accès non autorisé pour ${userEmail} sur ${dossierRef}`);
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
    
    console.log(`📝 [sendMessage] Message préparé - id: ${messageId}, sender: ${senderName}, content length: ${newMessage.content.length}`);

    // 3. Écrire UNIQUEMENT dans GitHub
    const success = await addMessageToGitHub(dossierRef, newMessage);

    if (!success) {
      console.error(`❌ [sendMessage] Échec écriture GitHub pour ${dossierRef}`);
      return { success: false, error: "Erreur lors de l’écriture dans GitHub" };
    }

    // ✅ 4. Plus de mise à jour de messagerie_conversations
    revalidatePath("/messagerie");

    const duration = Date.now() - startTime;
    console.log(`✅ [sendMessage] Terminé en ${duration}ms - Message envoyé avec succès`);
    return { success: true };
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [sendMessage] Erreur après ${duration}ms:`, errorMsg);
    console.error(`❌ [sendMessage] Stack:`, err instanceof Error ? err.stack : "no stack");
    return { success: false, error: "Erreur interne" };
  }
}
