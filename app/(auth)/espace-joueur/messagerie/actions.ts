
"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { GitHubDB } from "@/lib/github-db/client";

// ==========================================================
// TYPES
// ==========================================================

export interface PlayerMessage {
  id: string;
  content: string;
  created_at: string;
  sender: "player" | "staff" | "system";
  sender_name: string;
  document_url?: string | null;
}

export interface PlayerConversation {
  dossier_ref: string;
  participant_name: string;
  participant_email: string;
  last_message: string;
  last_message_date: string;
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
  console.error("Configuration Supabase manquante pour messagerie joueur");
}

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Mapping ville → email staff
const STAFF_EMAILS: Record<string, string> = {
  "NANTES": "nantes@vagondys.com",
  "LYON": "lyon@vagondys.com",
  "PARIS": "paris@vagondys.com",
  "MARSEILLE": "marseille@vagondys.com",
  "BORDEAUX": "bordeaux@vagondys.com",
  "LILLE": "lille@vagondys.com",
  "TOULOUSE": "toulouse@vagondys.com",
  "MADRID": "madrid@vagondys.com",
  "MASTER": "admin@vagondys.com",
};

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
  console.log(`📖 [GitHub-Joueur] Lecture ${path}`);
  
  try {
    const messages = await GitHubDB.read<GitHubMessage[]>(path);
    const count = messages?.length || 0;
    const duration = Date.now() - startTime;
    console.log(`✅ [GitHub-Joueur] ${count} messages lus depuis ${path} en ${duration}ms`);
    return messages || [];
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(`⚠️ [GitHub-Joueur] Lecture échouée pour ${path} en ${duration}ms: ${errorMsg}`);
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
  console.log(`💾 [GitHub-Joueur] Écriture dans ${path}`);
  console.log(`📝 [GitHub-Joueur] Message: id=${message.id}, sender=${message.sender_email}, content length=${message.content.length}`);
  
  try {
    // Lire les messages existants
    let existingMessages: GitHubMessage[] = [];
    try {
      const existing = await GitHubDB.read<GitHubMessage[]>(path);
      if (existing && Array.isArray(existing)) {
        existingMessages = existing;
        console.log(`📖 [GitHub-Joueur] ${existingMessages.length} messages existants lus`);
      } else if (existing) {
        console.log(`⚠️ [GitHub-Joueur] Données existantes non tableau, type: ${typeof existing}`);
        existingMessages = [];
      } else {
        console.log(`ℹ️ [GitHub-Joueur] Aucun message existant, création du fichier`);
        existingMessages = [];
      }
    } catch (readError) {
      const readErrorMsg = readError instanceof Error ? readError.message : String(readError);
      console.log(`ℹ️ [GitHub-Joueur] Lecture existante échouée (fichier probablement inexistant): ${readErrorMsg}`);
      existingMessages = [];
    }
    
    // Ajouter le nouveau message
    existingMessages.push(message);
    console.log(`📊 [GitHub-Joueur] Total messages après ajout: ${existingMessages.length}`);
    
    // Écrire dans GitHub (compressé)
    const writeStartTime = Date.now();
    await GitHubDB.write(path, existingMessages, { compress: true });
    const writeDuration = Date.now() - writeStartTime;
    const totalDuration = Date.now() - startTime;
    
    console.log(`✅ [GitHub-Joueur] Message écrit dans GitHub en ${writeDuration}ms (total ${totalDuration}ms): ${path}`);
    return true;
    
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStatus = (err as { status?: number })?.status;
    
    console.error(`❌ [GitHub-Joueur] Erreur écriture - status: ${errorStatus}, message: ${errorMsg}, durée: ${totalDuration}ms`);
    console.error(`❌ [GitHub-Joueur] Détail erreur:`, err);
    return false;
  }
}

// ==========================================================
// FONCTIONS PRINCIPALES
// ==========================================================

/**
 * Récupère les informations du joueur depuis athletes_registry
 */
async function getPlayerInfo(userId: string, userEmail: string): Promise<{ dossier_ref: string; city: string; country: string; full_name: string } | null> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Configuration Supabase manquante");
    return null;
  }

  try {
    // Rechercher par user_id d'abord
    let { data: registry } = await supabase
      .from("athletes_registry")
      .select("dossier_ref, city, country, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Fallback par email
    if (!registry && userEmail) {
      const { data: registryByEmail } = await supabase
        .from("athletes_registry")
        .select("dossier_ref, city, country, user_id")
        .eq("email", userEmail.toLowerCase())
        .maybeSingle();

      if (registryByEmail) {
        registry = registryByEmail;
      }
    }

    if (!registry || !registry.dossier_ref) {
      console.error("Aucun dossier_ref trouvé pour le joueur", { userId, userEmail });
      return null;
    }

    // Récupérer le nom depuis athletes (fallback sur userEmail si pas trouvé)
    let fullName = "Joueur";
    try {
      const { data: athlete } = await supabase
        .from("athletes")
        .select("full_name")
        .eq("id", registry.user_id || userId)
        .maybeSingle();
      
      if (athlete?.full_name) {
        fullName = athlete.full_name;
      } else {
        const emailParts = userEmail.split('@')[0];
        fullName = emailParts.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch {
      console.warn("⚠️ Table athletes inaccessible, utilisation du nom par défaut");
      const emailParts = userEmail.split('@')[0];
      fullName = emailParts.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return {
      dossier_ref: registry.dossier_ref,
      city: registry.city || "NANTES",
      country: registry.country || "FR",
      full_name: fullName,
    };
  } catch (err) {
    console.error("Erreur getPlayerInfo:", err);
    return null;
  }
}

/**
 * Récupère l'email du staff responsable d'une ville
 */
function getStaffEmailForCity(city: string): string {
  const upperCity = city.toUpperCase().trim();
  return STAFF_EMAILS[upperCity] || STAFF_EMAILS["MASTER"];
}

/**
 * Récupère la conversation du joueur (une seule, basée sur son dossier_ref)
 * ✅ CORRECTION : Lecture UNIQUEMENT depuis GitHub
 */
export async function getPlayerConversation(
  userId: string,
  userEmail: string
): Promise<PlayerConversation | null> {
  const startTime = Date.now();
  console.log(`👤 [getPlayerConversation] Début pour userId: ${userId}, email: ${userEmail}`);

  try {
    // 1. Récupérer les infos du joueur
    const playerInfo = await getPlayerInfo(userId, userEmail);
    if (!playerInfo) {
      console.error("❌ [getPlayerConversation] Impossible de trouver les infos du joueur");
      return null;
    }

    console.log(`✅ [getPlayerConversation] Infos trouvées: dossier=${playerInfo.dossier_ref}, city=${playerInfo.city}`);

    // 2. Lire les messages depuis GitHub
    const messages = await getMessagesFromGitHub(playerInfo.dossier_ref);

    // 3. Trouver le dernier message
    let lastMessage = "Aucun message";
    let lastMessageDate = new Date().toISOString();

    if (messages.length > 0) {
      const sorted = [...messages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastMessage = sorted[0].content.substring(0, 100);
      lastMessageDate = sorted[0].created_at;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerConversation] Terminé en ${duration}ms, ${messages.length} messages`);

    return {
      dossier_ref: playerInfo.dossier_ref,
      participant_name: "Support VAGONDYS",
      participant_email: getStaffEmailForCity(playerInfo.city),
      last_message: lastMessage,
      last_message_date: lastMessageDate,
      created_at: new Date().toISOString(),
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerConversation] Erreur après ${duration}ms:`, err);
    return null;
  }
}

/**
 * Récupère tous les messages du joueur
 * ✅ CORRECTION : Lecture UNIQUEMENT depuis GitHub
 * ✅ CORRECTION : Tri chronologique (du plus ancien au plus récent)
 */
export async function getPlayerMessages(
  userId: string,
  userEmail: string,
  dossierRef?: string
): Promise<PlayerMessage[]> {
  const startTime = Date.now();
  console.log(`💬 [getPlayerMessages] Début pour userId: ${userId}, dossierRef: ${dossierRef || "auto"}`);

  try {
    // 1. Récupérer les infos du joueur si dossierRef non fourni
    let targetDossierRef = dossierRef;

    if (!targetDossierRef) {
      const playerInfo = await getPlayerInfo(userId, userEmail);
      if (!playerInfo) {
        console.error("❌ [getPlayerMessages] Impossible de trouver les infos du joueur");
        return [];
      }
      targetDossierRef = playerInfo.dossier_ref;
    }

    // 2. Lire les messages depuis GitHub
    const gitHubMessages = await getMessagesFromGitHub(targetDossierRef);

    // 3. Trier par date croissante (du plus ancien au plus récent)
    gitHubMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 4. Formater les messages pour le frontend
    const formattedMessages: PlayerMessage[] = gitHubMessages.map((msg: GitHubMessage) => {
      const isSystem = msg.sender_email === "system@vagondys.com";
      const isStaff = msg.sender_email.endsWith("@vagondys.com") && !isSystem;
      const isPlayer = msg.sender_email === userEmail.toLowerCase();
      
      let sender: "player" | "staff" | "system" = "player";
      let senderName = msg.sender_name;

      if (isSystem) {
        sender = "system";
        senderName = "Système VAGONDYS";
      } else if (isStaff) {
        sender = "staff";
        senderName = msg.sender_name || "Staff VAGONDYS";
      } else if (isPlayer) {
        sender = "player";
        senderName = "Moi";
      } else {
        sender = "staff";
        senderName = msg.sender_name || "Staff VAGONDYS";
      }

      return {
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender: sender,
        sender_name: senderName,
        document_url: msg.file_url || null,
      };
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerMessages] ${formattedMessages.length} messages retournés en ${duration}ms`);

    return formattedMessages;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerMessages] Erreur après ${duration}ms:`, err);
    return [];
  }
}

/**
 * Envoie un message depuis le joueur vers le staff de la ville choisie
 * ✅ CORRECTION : Écriture UNIQUEMENT dans GitHub
 */
export async function sendPlayerMessage(params: {
  dossierRef: string;
  content: string;
  userId: string;
  userEmail: string;
  userName: string;
  targetCity?: string;
  fileUrl?: string;
  fileKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const { dossierRef, content, userId, userEmail, userName, fileUrl, fileKey } = params;

  console.log(`📤 [sendPlayerMessage] Début - dossier: ${dossierRef}, user: ${userEmail}, content length: ${content?.length || 0}`);

  if (!dossierRef || !content || !userId || !userEmail) {
    console.error(`❌ [sendPlayerMessage] Paramètres manquants`);
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    // 1. Vérifier que l'utilisateur a accès à ce dossier
    const { data: account, error: accountError } = await supabase
      .from("messagerie_accounts")
      .select("full_name")
      .eq("user_id", userId)
      .eq("dossier_ref", dossierRef)
      .maybeSingle();

    if (accountError) {
      console.error(`⚠️ [sendPlayerMessage] Erreur vérification accès:`, accountError);
    }

    if (!account) {
      console.error(`❌ [sendPlayerMessage] Accès non autorisé pour ${userEmail} sur ${dossierRef}`);
      return { success: false, error: "Accès non autorisé" };
    }

    // 2. Préparer le message
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    const newMessage: GitHubMessage = {
      id: messageId,
      dossier_ref: dossierRef,
      sender_email: userEmail.toLowerCase(),
      sender_name: userName || account.full_name || "Joueur",
      content: content.trim(),
      file_url: fileUrl || null,
      file_key: fileKey || null,
      is_read: false,
      created_at: now,
    };
    
    console.log(`📝 [sendPlayerMessage] Message préparé - id: ${messageId}, sender: ${newMessage.sender_name}`);

    // 3. Écrire dans GitHub
    const success = await addMessageToGitHub(dossierRef, newMessage);

    if (!success) {
      console.error(`❌ [sendPlayerMessage] Échec écriture GitHub pour ${dossierRef}`);
      return { success: false, error: "Erreur lors de l’écriture dans GitHub" };
    }

    revalidatePath("/espace-joueur/messagerie");

    const duration = Date.now() - startTime;
    console.log(`✅ [sendPlayerMessage] Terminé en ${duration}ms, message envoyé avec succès`);

    return { success: true };
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [sendPlayerMessage] Erreur après ${duration}ms:`, errorMsg);
    return { success: false, error: "Erreur lors de l'envoi du message" };
  }
}
