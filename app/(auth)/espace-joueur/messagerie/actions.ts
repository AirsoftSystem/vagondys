
"use server";

import { fetchGitHubArchive } from "@/lib/supabase/client";
import { createClient } from "@supabase/supabase-js";

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

// Type flexible pour les messages bruts de l'archive
type RawMessage = Record<string, unknown>;

// ==========================================================
// CONFIGURATION
// ==========================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

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

    // Récupérer le nom depuis athletes
    const { data: athlete } = await supabase
      .from("athletes")
      .select("full_name")
      .eq("id", registry.user_id || userId)
      .maybeSingle();

    return {
      dossier_ref: registry.dossier_ref,
      city: registry.city || "NANTES",
      country: registry.country || "FR",
      full_name: athlete?.full_name || "Joueur",
    };
  } catch (err) {
    console.error("Erreur getPlayerInfo:", err);
    return null;
  }
}

/**
 * Convertit un message de l'archive GitHub en format frontend
 * Utilise un type flexible pour éviter les erreurs de typage
 */
function convertArchiveMessageToPlayerMessage(
  msg: RawMessage,
  playerEmail: string
): PlayerMessage | null {
  const content = msg.content as string | undefined;
  const createdAt = msg.created_at as string | undefined;
  
  if (!content || !createdAt) return null;

  const role = msg.role as string | undefined;
  const sender = msg.sender as string | undefined;
  const agentEmail = msg.agent_email as string | undefined;
  const msgId = msg.id as string | undefined;
  const documentUrl = msg.document_url as string | null | undefined;

  const isSystem = role === "CLIENT_CONTACT_INFO" || sender === "SYSTEM";
  const isStaff = !!agentEmail || (role !== "public" && !isSystem);
  const isPlayer = sender === playerEmail || role === "public";

  let messageSender: "player" | "staff" | "system" = "player";
  let senderName = "";

  if (isSystem) {
    messageSender = "system";
    senderName = "Système VAGONDYS";
  } else if (isStaff) {
    messageSender = "staff";
    senderName = agentEmail?.split("@")[0] || "Staff VAGONDYS";
  } else if (isPlayer) {
    messageSender = "player";
    senderName = "Moi";
  } else {
    messageSender = "staff";
    senderName = "Staff VAGONDYS";
  }

  return {
    id: (msgId as string) || `msg_${createdAt}`,
    content: content,
    created_at: createdAt,
    sender: messageSender,
    sender_name: senderName,
    document_url: documentUrl || null,
  };
}

/**
 * Récupère la conversation du joueur (une seule, basée sur son dossier_ref)
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

    // 2. Lire l'archive GitHub
    const archive = await fetchGitHubArchive(
      playerInfo.dossier_ref,
      playerInfo.city,
      playerInfo.country
    );

    if (!archive) {
      console.log(`ℹ️ [getPlayerConversation] Aucune archive trouvée pour ${playerInfo.dossier_ref}`);
      return {
        dossier_ref: playerInfo.dossier_ref,
        participant_name: "Support VAGONDYS",
        participant_email: "support@vagondys.com",
        last_message: "Aucun message",
        last_message_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    }

    // 3. Extraire le dernier message
    let lastMessage = "Aucun message";
    let lastMessageDate = archive.date_archivage || archive.dossier.created_at;

    const allMessages = [
      ...(archive.fil_de_discussion || []),
      ...(archive.echanges_staff || []),
    ];

    if (allMessages.length > 0) {
      const sorted = [...allMessages].sort(
        (a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }
      );
      const latest = sorted[0];
      lastMessage = latest.content?.substring(0, 100) || "Message";
      lastMessageDate = latest.created_at || lastMessageDate;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerConversation] Terminé en ${duration}ms`);

    return {
      dossier_ref: playerInfo.dossier_ref,
      participant_name: "Support VAGONDYS",
      participant_email: "support@vagondys.com",
      last_message: lastMessage,
      last_message_date: lastMessageDate,
      created_at: archive.dossier.created_at,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerConversation] Erreur après ${duration}ms:`, err);
    return null;
  }
}

/**
 * Récupère tous les messages du joueur
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
    let playerCity = "NANTES";
    let playerCountry = "FR";

    if (!targetDossierRef) {
      const playerInfo = await getPlayerInfo(userId, userEmail);
      if (!playerInfo) {
        console.error("❌ [getPlayerMessages] Impossible de trouver les infos du joueur");
        return [];
      }
      targetDossierRef = playerInfo.dossier_ref;
      playerCity = playerInfo.city;
      playerCountry = playerInfo.country;
    }

    // 2. Lire l'archive GitHub
    const archive = await fetchGitHubArchive(targetDossierRef, playerCity, playerCountry);

    if (!archive) {
      console.log(`ℹ️ [getPlayerMessages] Aucune archive trouvée pour ${targetDossierRef}`);
      return [];
    }

    // 3. Collecter tous les messages (utiliser RawMessage pour la flexibilité)
    const rawMessages: RawMessage[] = [];

    // Ajouter fil_de_discussion
    if (archive.fil_de_discussion && archive.fil_de_discussion.length > 0) {
      for (const msg of archive.fil_de_discussion) {
        rawMessages.push(msg as RawMessage);
      }
    }

    // Ajouter echanges_staff
    if (archive.echanges_staff && archive.echanges_staff.length > 0) {
      for (const reply of archive.echanges_staff) {
        rawMessages.push(reply as RawMessage);
      }
    }

    // 4. Convertir et trier
    const playerEmailLower = userEmail.toLowerCase();
    const messages: PlayerMessage[] = [];

    for (const msg of rawMessages) {
      const converted = convertArchiveMessageToPlayerMessage(msg, playerEmailLower);
      if (converted) {
        messages.push(converted);
      }
    }

    // Trier par date croissante (du plus ancien au plus récent)
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerMessages] ${messages.length} messages retournés en ${duration}ms`);

    return messages;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerMessages] Erreur après ${duration}ms:`, err);
    return [];
  }
}

/**
 * Envoie un message depuis le joueur vers le staff
 * Utilise l'API /api/send-reply qui gère déjà l'archivage GitHub
 */
export async function sendPlayerMessage(params: {
  dossierRef: string;
  content: string;
  userId: string;
  userEmail: string;
  userName: string;
  fileUrl?: string;
  fileKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dossierRef, content, userId, userEmail, userName: _userName, fileUrl, fileKey } = params;

  console.log(`📤 [sendPlayerMessage] Début - dossier: ${dossierRef}, user: ${userEmail}, content length: ${content?.length || 0}`);

  if (!dossierRef || !content || !userId || !userEmail) {
    return { success: false, error: "Paramètres manquants" };
  }

  try {
    // Récupérer la ville du joueur pour l'archivage
    let playerCity = "NANTES";
    let playerCountry = "FR";

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: registry } = await supabase
        .from("athletes_registry")
        .select("city, country")
        .eq("dossier_ref", dossierRef)
        .maybeSingle();
      if (registry) {
        playerCity = registry.city || "NANTES";
        playerCountry = registry.country || "FR";
      }
    }

    // Appel à l'API send-reply (réutilise la logique existante)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://vagondys.com";
    const response = await fetch(`${baseUrl}/api/send-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        messageId: `player_${Date.now()}`,
        to: "support@vagondys.com",
        subject: "MESSAGE JOUEUR",
        message: content,
        agentEmail: userEmail,
        docLink: fileUrl || null,
        fileKey: fileKey || null,
        dossierRef: dossierRef,
        cityCode: playerCity,
        countryCode: playerCountry,
        silent: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [sendPlayerMessage] Erreur API: ${response.status} - ${errorText}`);
      return { success: false, error: `Erreur API: ${response.status}` };
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [sendPlayerMessage] Terminé en ${duration}ms`);

    return { success: true };
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [sendPlayerMessage] Erreur après ${duration}ms:`, errorMsg);
    return { success: false, error: "Erreur lors de l'envoi du message" };
  }
}
