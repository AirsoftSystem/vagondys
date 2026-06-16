
"use server";

import { createClient } from "@supabase/supabase-js";
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

// Type pour un message GitHub
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
// FONCTIONS GITHUB
// ==========================================================

/**
 * Récupère les messages d'une conversation depuis GitHub
 */
async function getMessagesFromGitHub(dossierRef: string): Promise<GitHubMessage[]> {
  const path = `conversations/${dossierRef}/messages.json.gz`;
  console.log(`📖 [GitHub] Lecture ${path}`);
  
  try {
    const messages = await GitHubDB.read<GitHubMessage[]>(path);
    console.log(`✅ [GitHub] ${messages?.length || 0} messages lus depuis ${path}`);
    return messages || [];
  } catch (err) {
    console.log(`⚠️ [GitHub] Lecture échouée pour ${path}:`, err);
    return [];
  }
}

// ==========================================================
// FONCTIONS PRINCIPALES
// ==========================================================

/**
 * Récupère les informations du joueur depuis athletes_registry
 */
async function getPlayerInfo(userId: string, userEmail: string): Promise<{ dossier_ref: string; city: string; country: string; full_name: string } | null> {
  try {
    let { data: registry } = await supabase
      .from("athletes_registry")
      .select("dossier_ref, city, country, user_id")
      .eq("user_id", userId)
      .maybeSingle();

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
 * Récupère le token d'authentification pour appeler l'API
 */
async function getAuthToken(): Promise<string | null> {
  const supabaseClient = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.access_token || null;
}

/**
 * Récupère la conversation du joueur
 * ✅ CORRECTION : Source UNIQUE = GitHub (comme l'interface Super Admin)
 */
export async function getPlayerConversation(
  userId: string,
  userEmail: string
): Promise<PlayerConversation | null> {
  console.log(`👤 [getPlayerConversation] Début pour userId: ${userId}, email: ${userEmail}`);

  try {
    const playerInfo = await getPlayerInfo(userId, userEmail);
    if (!playerInfo) {
      console.error("❌ [getPlayerConversation] Impossible de trouver les infos du joueur");
      return null;
    }

    console.log(`✅ [getPlayerConversation] Infos trouvées: dossier=${playerInfo.dossier_ref}`);

    // Récupérer les messages depuis GitHub
    const gitHubMessages = await getMessagesFromGitHub(playerInfo.dossier_ref);

    if (gitHubMessages.length === 0) {
      return {
        dossier_ref: playerInfo.dossier_ref,
        participant_name: "Support VAGONDYS",
        participant_email: "support@vagondys.com",
        last_message: "Aucun message",
        last_message_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    }

    // Trier par date décroissante
    gitHubMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = gitHubMessages[0];

    // Déterminer le participant
    const isPlayerMessage = latest.sender_email === userEmail;
    const participantName = isPlayerMessage ? "Support VAGONDYS" : latest.sender_name;
    const participantEmail = isPlayerMessage ? "support@vagondys.com" : latest.sender_email;

    return {
      dossier_ref: playerInfo.dossier_ref,
      participant_name: participantName,
      participant_email: participantEmail,
      last_message: latest.content.substring(0, 100),
      last_message_date: latest.created_at,
      created_at: gitHubMessages[gitHubMessages.length - 1]?.created_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error(`❌ [getPlayerConversation] Erreur:`, err);
    return null;
  }
}

/**
 * Récupère tous les messages du joueur
 * ✅ CORRECTION : Source UNIQUE = GitHub (comme l'interface Super Admin)
 * ✅ Tri décroissant (du plus récent au plus ancien)
 */
export async function getPlayerMessages(
  userId: string,
  userEmail: string,
  dossierRef?: string
): Promise<PlayerMessage[]> {
  console.log(`💬 [getPlayerMessages] Début pour userId: ${userId}, dossierRef: ${dossierRef || "auto"}`);

  try {
    let targetDossierRef = dossierRef;

    if (!targetDossierRef) {
      const playerInfo = await getPlayerInfo(userId, userEmail);
      if (!playerInfo) {
        console.error("❌ [getPlayerMessages] Impossible de trouver les infos du joueur");
        return [];
      }
      targetDossierRef = playerInfo.dossier_ref;
    }

    // Lire les messages depuis GitHub
    const gitHubMessages = await getMessagesFromGitHub(targetDossierRef);

    // Trier par date décroissante (du plus récent au plus ancien)
    gitHubMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Convertir en PlayerMessage
    const playerMessages: PlayerMessage[] = gitHubMessages.map((msg) => {
      const isPlayer = msg.sender_email === userEmail;
      const isStaff = msg.sender_email.endsWith("@vagondys.com") || msg.sender_email === "system@vagondys.com";
      
      let sender: "player" | "staff" | "system" = "player";
      if (isStaff) sender = "staff";
      else if (!isPlayer) sender = "staff";
      
      return {
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender: sender,
        sender_name: isPlayer ? "Moi" : msg.sender_name,
        document_url: msg.file_url || null,
      };
    });

    console.log(`✅ [getPlayerMessages] ${playerMessages.length} messages retournés`);
    return playerMessages;
  } catch (err) {
    console.error(`❌ [getPlayerMessages] Erreur:`, err);
    return [];
  }
}

/**
 * Envoie un message depuis le joueur
 * ✅ CORRECTION : Écrit dans GitHub (comme l'interface Super Admin)
 * ✅ Appelle l'API /api/player/message qui écrit dans GitHub
 */
export async function sendPlayerMessage(params: {
  dossierRef: string;
  content: string;
  userId: string;
  userEmail: string;
  userName: string;
  targetCity?: string;
  subject?: string;
  fileUrl?: string;
  fileKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const { dossierRef, content, targetCity, subject, fileUrl, fileKey } = params;

  console.log(`📤 [sendPlayerMessage] Début - dossier: ${dossierRef}, targetCity: ${targetCity || "MASTER"}, subject: ${subject || "COMMUNICATION"}`);

  if (!dossierRef || !content) {
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      console.error("❌ [sendPlayerMessage] Impossible d'obtenir le token d'authentification");
      return { success: false, error: "Session expirée, veuillez vous reconnecter" };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://vagondys.com";
    
    const response = await fetch(`${baseUrl}/api/player/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        dossierRef,
        content,
        targetCity: targetCity || "MASTER",
        subject: subject || "COMMUNICATION",
        fileUrl: fileUrl || null,
        fileKey: fileKey || null,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error(`❌ [sendPlayerMessage] Erreur API: ${response.status} - ${result.error}`);
      return { success: false, error: result.error || `Erreur API: ${response.status}` };
    }

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
