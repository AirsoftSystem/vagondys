
"use server";

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

// Type pour un message provenant de pending_signals
interface PendingSignalMessage {
  id: string;
  created_at: string;
  dossier_ref: string;
  payload: {
    name?: string;
    email?: string;
    message?: string;
    subject?: string;
    messages_history?: Array<{ content: string; created_at: string }>;
  };
  confirmed?: boolean;
  is_read?: boolean;
}

// Type pour un message provenant de communication_replies
interface CommunicationReply {
  id: string;
  created_at: string;
  dossier_ref: string;
  agent_email: string;
  content: string;
  document_url?: string | null;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
 * Récupère l'email du staff responsable d'une ville
 */
function getStaffEmailForCity(city: string): string {
  const upperCity = city.toUpperCase().trim();
  return STAFF_EMAILS[upperCity] || STAFF_EMAILS["MASTER"];
}

/**
 * Récupère le token d'authentification pour appeler l'API
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Convertit un message de pending_signals en PlayerMessage
 */
function convertPendingSignalToPlayerMessage(
  signal: PendingSignalMessage,
  playerEmail: string
): PlayerMessage | null {
  const payload = signal.payload;
  if (!payload) return null;

  const content = payload.message || "Message sans contenu";
  const createdAt = signal.created_at;

  const isPlayer = payload.email === playerEmail;
  
  return {
    id: signal.id,
    content: content,
    created_at: createdAt,
    sender: isPlayer ? "player" : "staff",
    sender_name: isPlayer ? "Moi" : (payload.name || "Staff VAGONDYS"),
    document_url: null,
  };
}

/**
 * Convertit un message de communication_replies en PlayerMessage
 */
function convertReplyToPlayerMessage(
  reply: CommunicationReply
): PlayerMessage | null {
  if (!reply.content) return null;

  return {
    id: reply.id,
    content: reply.content,
    created_at: reply.created_at,
    sender: "staff",
    sender_name: reply.agent_email?.split("@")[0] || "Staff VAGONDYS",
    document_url: reply.document_url || null,
  };
}

/**
 * Fonction utilitaire : normalise une date en nombre (millisecondes)
 */
function normalizeDate(dateStr: string): number {
  try {
    if (typeof dateStr === 'number') return dateStr;
    const date = new Date(dateStr);
    return date.getTime();
  } catch {
    return 0;
  }
}

/**
 * Récupère la conversation du joueur
 * ✅ CORRECTION : Source UNIQUE = Supabase (pending_signals + communication_replies)
 * ✅ Fonctionne comme l'interface staff
 */
export async function getPlayerConversation(
  userId: string,
  userEmail: string
): Promise<PlayerConversation | null> {
  const startTime = Date.now();
  console.log(`👤 [getPlayerConversation] Début pour userId: ${userId}, email: ${userEmail}`);

  try {
    const playerInfo = await getPlayerInfo(userId, userEmail);
    if (!playerInfo) {
      console.error("❌ [getPlayerConversation] Impossible de trouver les infos du joueur");
      return null;
    }

    console.log(`✅ [getPlayerConversation] Infos trouvées: dossier=${playerInfo.dossier_ref}, city=${playerInfo.city}`);

    const allMessages: PlayerMessage[] = [];
    const messageKeys = new Set<string>(); // Dédoublonnage

    const addUniqueMessage = (msg: PlayerMessage) => {
      const key = `${msg.content}_${normalizeDate(msg.created_at)}`;
      if (!messageKeys.has(key)) {
        messageKeys.add(key);
        allMessages.push(msg);
      }
    };

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Récupérer depuis pending_signals
    const { data: signals } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", playerInfo.dossier_ref)
      .order("created_at", { ascending: true });

    if (signals && signals.length > 0) {
      for (const signal of signals as PendingSignalMessage[]) {
        // Message principal
        const mainMsg = convertPendingSignalToPlayerMessage(signal, userEmail);
        if (mainMsg) addUniqueMessage(mainMsg);
        
        // Historique des messages
        if (signal.payload?.messages_history && signal.payload.messages_history.length > 0) {
          for (const histMsg of signal.payload.messages_history) {
            if (histMsg.content !== signal.payload.message) {
              addUniqueMessage({
                id: `${signal.id}_hist_${histMsg.created_at}`,
                content: histMsg.content,
                created_at: histMsg.created_at,
                sender: "player",
                sender_name: "Moi",
                document_url: null,
              });
            }
          }
        }
      }
      console.log(`📦 [getPlayerConversation] ${allMessages.length} messages depuis pending_signals`);
    }

    // 2. Récupérer depuis communication_replies
    const { data: replies } = await supabase
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", playerInfo.dossier_ref)
      .order("created_at", { ascending: true });

    if (replies && replies.length > 0) {
      for (const reply of replies as CommunicationReply[]) {
        const converted = convertReplyToPlayerMessage(reply);
        if (converted) addUniqueMessage(converted);
      }
      console.log(`📦 [getPlayerConversation] ${allMessages.length} messages au total (avec replies)`);
    }

    if (allMessages.length === 0) {
      return {
        dossier_ref: playerInfo.dossier_ref,
        participant_name: "Support VAGONDYS",
        participant_email: getStaffEmailForCity(playerInfo.city),
        last_message: "Aucun message",
        last_message_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    }

    // ✅ Tri décroissant (du plus récent au plus ancien)
    const sortedMessages = [...allMessages].sort((a, b) => {
      const dateA = normalizeDate(a.created_at);
      const dateB = normalizeDate(b.created_at);
      return dateB - dateA;
    });

    const latest = sortedMessages[0];

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerConversation] Terminé en ${duration}ms, ${allMessages.length} messages`);

    return {
      dossier_ref: playerInfo.dossier_ref,
      participant_name: "Support VAGONDYS",
      participant_email: getStaffEmailForCity(playerInfo.city),
      last_message: latest.content.substring(0, 100),
      last_message_date: latest.created_at,
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
 * ✅ CORRECTION : Source UNIQUE = Supabase (pending_signals + communication_replies)
 * ✅ Fonctionne comme l'interface staff
 * ✅ Tri décroissant (du plus récent au plus ancien)
 * ✅ Suppression des variables inutilisées playerCity et playerCountry
 */
export async function getPlayerMessages(
  userId: string,
  userEmail: string,
  dossierRef?: string
): Promise<PlayerMessage[]> {
  const startTime = Date.now();
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

    const allMessages: PlayerMessage[] = [];
    const messageKeys = new Set<string>(); // Dédoublonnage

    const addUniqueMessage = (msg: PlayerMessage) => {
      const key = `${msg.content}_${normalizeDate(msg.created_at)}`;
      if (!messageKeys.has(key)) {
        messageKeys.add(key);
        allMessages.push(msg);
      }
    };

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Récupérer depuis pending_signals
    const { data: signals } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", targetDossierRef)
      .order("created_at", { ascending: true });

    if (signals && signals.length > 0) {
      for (const signal of signals as PendingSignalMessage[]) {
        // Message principal
        const mainMsg = convertPendingSignalToPlayerMessage(signal, userEmail);
        if (mainMsg) addUniqueMessage(mainMsg);
        
        // Historique des messages
        if (signal.payload?.messages_history && signal.payload.messages_history.length > 0) {
          for (const histMsg of signal.payload.messages_history) {
            if (histMsg.content !== signal.payload.message) {
              addUniqueMessage({
                id: `${signal.id}_hist_${histMsg.created_at}`,
                content: histMsg.content,
                created_at: histMsg.created_at,
                sender: "player",
                sender_name: "Moi",
                document_url: null,
              });
            }
          }
        }
      }
      console.log(`📦 [getPlayerMessages] ${allMessages.length} messages depuis pending_signals`);
    }

    // 2. Récupérer depuis communication_replies
    const { data: replies } = await supabase
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", targetDossierRef)
      .order("created_at", { ascending: true });

    if (replies && replies.length > 0) {
      for (const reply of replies as CommunicationReply[]) {
        const converted = convertReplyToPlayerMessage(reply);
        if (converted) addUniqueMessage(converted);
      }
      console.log(`📦 [getPlayerMessages] ${allMessages.length} messages au total (avec replies)`);
    }

    if (allMessages.length === 0) {
      console.log(`ℹ️ [getPlayerMessages] Aucun message trouvé pour ${targetDossierRef}`);
      return [];
    }

    // ✅ Tri décroissant (du plus récent au plus ancien)
    const sortedMessages = [...allMessages].sort((a, b) => {
      const dateA = normalizeDate(a.created_at);
      const dateB = normalizeDate(b.created_at);
      return dateB - dateA;
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerMessages] ${sortedMessages.length} messages retournés en ${duration}ms (tri décroissant)`);

    return sortedMessages;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerMessages] Erreur après ${duration}ms:`, err);
    return [];
  }
}

/**
 * Envoie un message depuis le joueur vers le staff de la ville choisie
 * ✅ Appelle l'API /api/player/message qui écrit dans pending_signals + communication_replies
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
  const { dossierRef, content, targetCity, fileUrl, fileKey } = params;

  console.log(`📤 [sendPlayerMessage] Début - dossier: ${dossierRef}, targetCity: ${targetCity || "MASTER"}, content length: ${content?.length || 0}`);

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
