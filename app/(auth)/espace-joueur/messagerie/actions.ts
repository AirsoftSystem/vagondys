
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
// FONCTIONS UTILITAIRES
// ==========================================================

/**
 * ✅ CORRECTION CRITIQUE : Convertit une date en format ISO standard
 * Quel que soit le format d'entrée, la sortie est TOUJOURS au format ISO
 * Cela garantit que TOUTES les dates sont comparables.
 */
function normalizeDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  try {
    let normalized = dateStr.trim();
    
    // Format français: "13/06/2026 09:17:55" → "2026-06-13T09:17:55.000Z"
    const frenchMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/);
    if (frenchMatch) {
      const [, day, month, year, time] = frenchMatch;
      normalized = `${year}-${month}-${day}T${time}.000Z`;
      return normalized;
    }
    
    // Format PostgreSQL: "2026-06-13 09:17:55" → "2026-06-13T09:17:55.000Z"
    const pgMatch = normalized.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
    if (pgMatch) {
      const [, date, time] = pgMatch;
      normalized = `${date}T${time}.000Z`;
      return normalized;
    }
    
    // Format ISO avec T mais sans millisecondes: "2026-06-13T09:17:55" → ajouter millisecondes
    const isoNoMsMatch = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/);
    if (isoNoMsMatch) {
      normalized = `${isoNoMsMatch[1]}.000Z`;
      return normalized;
    }
    
    // Format ISO déjà correct: "2026-06-13T09:17:55.123Z"
    const isoMatch = normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    if (isoMatch) {
      return normalized;
    }
    
    // Dernier recours: tenter de parser avec Date puis reformater en ISO
    const timestamp = Date.parse(normalized);
    if (!isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
    
    console.warn(`⚠️ [normalizeDateToISO] Format non reconnu: "${dateStr}", utilisation now`);
    return new Date().toISOString();
  } catch (err) {
    console.warn(`⚠️ [normalizeDateToISO] Erreur parsing: "${dateStr}"`, err);
    return new Date().toISOString();
  }
}

/**
 * Normalise une date pour un tri fiable (retourne timestamp numérique)
 */
function normalizeDate(dateStr: string): number {
  const isoString = normalizeDateToISO(dateStr);
  return new Date(isoString).getTime();
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
 * Récupère le token d'authentification pour appeler l'API
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Convertit un message de l'archive GitHub en format frontend
 * ✅ CORRECTION : Normalise la date en ISO
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
    created_at: normalizeDateToISO(createdAt), // ✅ Normalisation ISO
    sender: messageSender,
    sender_name: senderName,
    document_url: documentUrl || null,
  };
}

/**
 * Convertit un message de pending_signals en format frontend
 * ✅ CORRECTION : Normalise la date en ISO
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
    created_at: normalizeDateToISO(createdAt), // ✅ Normalisation ISO
    sender: isPlayer ? "player" : "staff",
    sender_name: isPlayer ? "Moi" : (payload.name || "Staff VAGONDYS"),
    document_url: null,
  };
}

/**
 * Convertit un message de communication_replies en format frontend
 * ✅ CORRECTION : Normalise la date en ISO
 */
function convertReplyToPlayerMessage(
  reply: CommunicationReply
): PlayerMessage | null {
  if (!reply.content) return null;

  return {
    id: reply.id,
    content: reply.content,
    created_at: normalizeDateToISO(reply.created_at), // ✅ Normalisation ISO
    sender: "staff",
    sender_name: reply.agent_email?.split("@")[0] || "Staff VAGONDYS",
    document_url: reply.document_url || null,
  };
}

/**
 * Récupère la conversation du joueur
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

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const allMessages: PlayerMessage[] = [];

    // Source 1: Archive GitHub
    const archive = await fetchGitHubArchive(
      playerInfo.dossier_ref,
      playerInfo.city,
      playerInfo.country
    );

    if (archive) {
      const rawMessages: RawMessage[] = [];
      if (archive.fil_de_discussion) {
        for (const msg of archive.fil_de_discussion) {
          rawMessages.push(msg as RawMessage);
        }
      }
      if (archive.echanges_staff) {
        for (const reply of archive.echanges_staff) {
          rawMessages.push(reply as RawMessage);
        }
      }
      for (const msg of rawMessages) {
        const converted = convertArchiveMessageToPlayerMessage(msg, userEmail);
        if (converted) allMessages.push(converted);
      }
    }

    // Source 2: pending_signals
    const { data: signals } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", playerInfo.dossier_ref)
      .order("created_at", { ascending: true });

    if (signals && signals.length > 0) {
      for (const signal of signals as PendingSignalMessage[]) {
        const mainMsg = convertPendingSignalToPlayerMessage(signal, userEmail);
        if (mainMsg) allMessages.push(mainMsg);
        
        if (signal.payload?.messages_history && signal.payload.messages_history.length > 0) {
          for (const histMsg of signal.payload.messages_history) {
            if (histMsg.content !== signal.payload.message) {
              allMessages.push({
                id: `${signal.id}_hist_${histMsg.created_at}`,
                content: histMsg.content,
                created_at: normalizeDateToISO(histMsg.created_at), // ✅ Normalisation ISO
                sender: "player",
                sender_name: "Moi",
                document_url: null,
              });
            }
          }
        }
      }
    }

    // Source 3: communication_replies
    const { data: replies } = await supabase
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", playerInfo.dossier_ref)
      .order("created_at", { ascending: true });

    if (replies && replies.length > 0) {
      for (const reply of replies as CommunicationReply[]) {
        const converted = convertReplyToPlayerMessage(reply);
        if (converted) allMessages.push(converted);
      }
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

    // ✅ Tri décroissant
    allMessages.sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at));
    const latest = allMessages[0];

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerConversation] Terminé en ${duration}ms, ${allMessages.length} messages`);

    return {
      dossier_ref: playerInfo.dossier_ref,
      participant_name: "Support VAGONDYS",
      participant_email: getStaffEmailForCity(playerInfo.city),
      last_message: latest.content.substring(0, 100),
      last_message_date: latest.created_at,
      created_at: archive?.dossier.created_at || new Date().toISOString(),
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

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const allMessages: PlayerMessage[] = [];
    const messageKeys = new Set<string>();

    const addUniqueMessage = (msg: PlayerMessage) => {
      const key = `${msg.content}_${msg.created_at}`;
      if (!messageKeys.has(key)) {
        messageKeys.add(key);
        allMessages.push(msg);
      }
    };

    // Source 1: Archive GitHub
    const archive = await fetchGitHubArchive(targetDossierRef, playerCity, playerCountry);
    if (archive) {
      const rawMessages: RawMessage[] = [];
      if (archive.fil_de_discussion) {
        for (const msg of archive.fil_de_discussion) {
          rawMessages.push(msg as RawMessage);
        }
      }
      if (archive.echanges_staff) {
        for (const reply of archive.echanges_staff) {
          rawMessages.push(reply as RawMessage);
        }
      }
      for (const msg of rawMessages) {
        const converted = convertArchiveMessageToPlayerMessage(msg, userEmail);
        if (converted) addUniqueMessage(converted);
      }
    }

    // Source 2: pending_signals
    const { data: signals } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", targetDossierRef)
      .order("created_at", { ascending: true });

    if (signals && signals.length > 0) {
      for (const signal of signals as PendingSignalMessage[]) {
        const mainMsg = convertPendingSignalToPlayerMessage(signal, userEmail);
        if (mainMsg) addUniqueMessage(mainMsg);
        
        if (signal.payload?.messages_history && signal.payload.messages_history.length > 0) {
          for (const histMsg of signal.payload.messages_history) {
            if (histMsg.content !== signal.payload.message) {
              addUniqueMessage({
                id: `${signal.id}_hist_${histMsg.created_at}`,
                content: histMsg.content,
                created_at: normalizeDateToISO(histMsg.created_at), // ✅ Normalisation ISO
                sender: "player",
                sender_name: "Moi",
                document_url: null,
              });
            }
          }
        }
      }
    }

    // Source 3: communication_replies
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
    }

    // ✅ Tri décroissant
    allMessages.sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at));

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerMessages] ${allMessages.length} messages retournés en ${duration}ms (tri décroissant)`);

    return allMessages;
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerMessages] Erreur après ${duration}ms:`, err);
    return [];
  }
}

/**
 * Envoie un message depuis le joueur vers le staff de la ville choisie
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
