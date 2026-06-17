
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

// Interface pour un message Supabase
interface SupabaseMessage {
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

// Interface pour un message GitHub
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
// SYNCHRONISATION GITHUB (ASYNCHRONE)
// ==========================================================

/**
 * Synchronise un message vers GitHub (en arrière-plan, non bloquant)
 * @param message - Le message à synchroniser
 */
async function syncMessageToGitHub(message: GitHubMessage): Promise<void> {
  try {
    const path = `conversations/${message.dossier_ref}/messages.json.gz`;
    
    // Lire les messages existants sur GitHub
    let existingMessages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(path);
      if (existing && Array.isArray(existing)) {
        existingMessages = existing;
      }
    } catch {
      // Fichier inexistant, on commence avec un tableau vide
      existingMessages = [];
    }
    
    // Vérifier si le message existe déjà (éviter les doublons)
    const exists = existingMessages.some((m) => m.id === message.id);
    if (!exists) {
      existingMessages.push(message);
      await GitHubDB.write(path, existingMessages, { compress: true });
      console.log(`✅ [GitHub-Sync] Message ${message.id} synchronisé vers GitHub`);
    }
  } catch (err) {
    // Non bloquant - on log l'erreur mais on ne bloque pas l'utilisateur
    console.error(`⚠️ [GitHub-Sync] Erreur synchronisation pour ${message.dossier_ref}:`, err);
  }
}

// ==========================================================
// FONCTIONS PRINCIPALES
// ==========================================================

/**
 * Récupère toutes les conversations d'un utilisateur
 * ✅ CORRECTION : Lecture depuis messagerie_messages (Supabase) pour la performance
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

    // Pour chaque dossier, récupérer le dernier message depuis Supabase (instantané)
    const conversations: Conversation[] = await Promise.all(
      accounts.map(async (account: MessagerieAccount) => {
        let lastMessage = "";
        let lastMessageDate = account.created_at;
        
        try {
          // ✅ Lire le dernier message depuis Supabase
          const { data: messages, error: msgError } = await supabase
            .from("messagerie_messages")
            .select("content, created_at")
            .eq("dossier_ref", account.dossier_ref)
            .order("created_at", { ascending: false })
            .limit(1);

          if (msgError) {
            console.error(`⚠️ [getUserConversations] Erreur lecture dernier message pour ${account.dossier_ref}:`, msgError);
          } else if (messages && messages.length > 0) {
            lastMessage = messages[0].content.substring(0, 100);
            lastMessageDate = messages[0].created_at;
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
 * ✅ CORRECTION : Lecture depuis messagerie_messages (Supabase) pour la performance
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

    // 2. Lire les messages depuis Supabase (instantané)
    const { data: messages, error: dbError } = await supabase
      .from("messagerie_messages")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error(`❌ [getConversationMessages] Erreur lecture Supabase:`, dbError);
      return [];
    }

    if (!messages || messages.length === 0) {
      console.log(`ℹ️ [getConversationMessages] Aucun message dans Supabase pour ${dossierRef}`);
      return [];
    }

    // 3. Formater les messages pour le frontend
    const formattedMessages: Message[] = (messages as SupabaseMessage[]).map((msg) => {
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
 * ✅ CORRECTION : Écriture dans Supabase (instantané) + synchronisation asynchrone vers GitHub
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

    const newMessage = {
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

    // 3. Écrire dans Supabase (instantané)
    const { error: insertError } = await supabase
      .from("messagerie_messages")
      .insert([newMessage]);

    if (insertError) {
      console.error(`❌ [sendMessage] Erreur insertion Supabase:`, insertError);
      return { success: false, error: "Erreur lors de l'enregistrement du message" };
    }

    // 4. Synchroniser vers GitHub (en arrière-plan, non bloquant)
    // On ne attend pas la fin de la synchronisation pour ne pas bloquer l'utilisateur
    const gitHubMessage: GitHubMessage = {
      ...newMessage,
      file_url: newMessage.file_url || null,
      file_key: newMessage.file_key || null,
    };
    
    // Lancer la synchronisation en arrière-plan (Promise non attendue)
    syncMessageToGitHub(gitHubMessage).catch((err) => {
      console.error(`⚠️ [sendMessage] Erreur synchro GitHub (non bloquante):`, err);
    });

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
