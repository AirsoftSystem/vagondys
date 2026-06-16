
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

// Type pour un message du fil_de_discussion
interface ThreadMessage {
  role?: string;
  sender?: string;
  content?: string;
  created_at?: string;
  agent_email?: string;
  id?: string;
  document_url?: string | null;
  [key: string]: unknown;
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
 * Convertit un message du fil_de_discussion en PlayerMessage
 */
function convertThreadMessageToPlayerMessage(
  msg: ThreadMessage,
  playerEmail: string
): PlayerMessage | null {
  const content = msg.content;
  const createdAt = msg.created_at;
  
  if (!content || !createdAt) return null;

  const role = msg.role;
  const sender = msg.sender;
  const agentEmail = msg.agent_email;

  let messageSender: "player" | "staff" | "system" = "player";
  let senderName = "";

  if (role === "system" || sender === "SYSTEM" || role === "CLIENT_CONTACT_INFO") {
    messageSender = "system";
    senderName = "Système VAGONDYS";
  } else if (agentEmail || (role !== "public" && role !== "system")) {
    messageSender = "staff";
    senderName = agentEmail?.split("@")[0] || "Staff VAGONDYS";
  } else if (sender === playerEmail || role === "public") {
    messageSender = "player";
    senderName = "Moi";
  } else {
    messageSender = "staff";
    senderName = "Staff VAGONDYS";
  }

  return {
    id: (msg.id as string) || `msg_${createdAt}`,
    content: content,
    created_at: createdAt,
    sender: messageSender,
    sender_name: senderName,
    document_url: msg.document_url || null,
  };
}

/**
 * FONCTION DE SECOURS : Récupère les messages depuis pending_signals
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
 * FONCTION DE SECOURS : Récupère les messages depuis communication_replies
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
 * Gère différents formats de date
 */
function normalizeDate(dateStr: string): number {
  try {
    // Si la date est déjà un nombre, la retourner
    if (typeof dateStr === 'number') return dateStr;
    // Sinon, la convertir en Date puis en timestamp
    const date = new Date(dateStr);
    return date.getTime();
  } catch {
    return 0;
  }
}

/**
 * Récupère la conversation du joueur
 * ✅ CORRECTION : Fusion et tri unifiés sur TOUTES les sources
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

    // ✅ Fusion de TOUTES les sources dans un SEUL tableau
    const allMessages: PlayerMessage[] = [];

    // 1. SOURCE 1 : Archive GitHub (fil_de_discussion + echanges_staff + fullThread)
    const archive = await fetchGitHubArchive(
      playerInfo.dossier_ref,
      playerInfo.city,
      playerInfo.country
    );

    if (archive) {
      // 1a. fil_de_discussion
      if (archive.fil_de_discussion && Array.isArray(archive.fil_de_discussion)) {
        for (const msg of archive.fil_de_discussion) {
          const converted = convertThreadMessageToPlayerMessage(msg as ThreadMessage, userEmail);
          if (converted) allMessages.push(converted);
        }
      }
      
      // 1b. echanges_staff
      if (archive.echanges_staff && Array.isArray(archive.echanges_staff)) {
        for (const reply of archive.echanges_staff) {
          const converted = convertThreadMessageToPlayerMessage(reply as ThreadMessage, userEmail);
          if (converted) allMessages.push(converted);
        }
      }
      
      // 1c. fullThread (messages système)
      if ('fullThread' in archive && Array.isArray((archive as { fullThread?: ThreadMessage[] }).fullThread)) {
        const fullThread = (archive as { fullThread: ThreadMessage[] }).fullThread;
        for (const msg of fullThread) {
          const converted = convertThreadMessageToPlayerMessage(msg, userEmail);
          if (converted) allMessages.push(converted);
        }
      }
      
      console.log(`📦 [getPlayerConversation] ${allMessages.length} messages depuis l'archive GitHub`);
    }

    // 2. SOURCE 2 : pending_signals (fallback / complément)
    if (allMessages.length === 0 || allMessages.length < 5) {
      console.log(`ℹ️ [getPlayerConversation] Complément avec Supabase pour ${playerInfo.dossier_ref}`);
      
      const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Récupérer depuis pending_signals
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
                  created_at: histMsg.created_at,
                  sender: "player",
                  sender_name: "Moi",
                  document_url: null,
                });
              }
            }
          }
        }
      }

      // Récupérer depuis communication_replies
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
      
      console.log(`💾 [getPlayerConversation] ${allMessages.length} messages totaux après fusion`);
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

    // ✅ TRI UNIFIÉ sur TOUS les messages (du plus récent au plus ancien)
    const sortedMessages = [...allMessages].sort((a, b) => {
      const dateA = normalizeDate(a.created_at);
      const dateB = normalizeDate(b.created_at);
      return dateB - dateA;
    });

    const latest = sortedMessages[0];

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerConversation] Terminé en ${duration}ms, ${allMessages.length} messages triés`);

    return {
      dossier_ref: playerInfo.dossier_ref,
      participant_name: "Support VAGONDYS",
      participant_email: getStaffEmailForCity(playerInfo.city),
      last_message: latest.content.substring(0, 100),
      last_message_date: latest.created_at,
      created_at: archive?.dossier?.created_at || new Date().toISOString(),
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ [getPlayerConversation] Erreur après ${duration}ms:`, err);
    return null;
  }
}

/**
 * Récupère tous les messages du joueur
 * ✅ CORRECTION : Fusion de TOUTES les sources (GitHub + Supabase) dans un SEUL tableau
 * ✅ CORRECTION : Tri UNIFIÉ sur l'ensemble des messages
 * ✅ CORRECTION : Dédoublonnage par contenu + date
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

    // ✅ Fusion de TOUTES les sources dans un SEUL tableau
    const allMessages: PlayerMessage[] = [];

    // 1. SOURCE 1 : Archive GitHub (fil_de_discussion + echanges_staff + fullThread)
    const archive = await fetchGitHubArchive(targetDossierRef, playerCity, playerCountry);

    if (archive) {
      // 1a. fil_de_discussion
      if (archive.fil_de_discussion && Array.isArray(archive.fil_de_discussion)) {
        for (const msg of archive.fil_de_discussion) {
          const converted = convertThreadMessageToPlayerMessage(msg as ThreadMessage, userEmail);
          if (converted) allMessages.push(converted);
        }
      }
      
      // 1b. echanges_staff
      if (archive.echanges_staff && Array.isArray(archive.echanges_staff)) {
        for (const reply of archive.echanges_staff) {
          const converted = convertThreadMessageToPlayerMessage(reply as ThreadMessage, userEmail);
          if (converted) allMessages.push(converted);
        }
      }
      
      // 1c. fullThread (messages système)
      if ('fullThread' in archive && Array.isArray((archive as { fullThread?: ThreadMessage[] }).fullThread)) {
        const fullThread = (archive as { fullThread: ThreadMessage[] }).fullThread;
        for (const msg of fullThread) {
          const converted = convertThreadMessageToPlayerMessage(msg, userEmail);
          if (converted) allMessages.push(converted);
        }
      }
      
      console.log(`📦 [getPlayerMessages] ${allMessages.length} messages depuis l'archive GitHub`);
    }

    // 2. SOURCE 2 : Supabase (pending_signals + communication_replies)
    // On les ajoute TOUJOURS pour compléter, même si l'archive existe
    console.log(`📦 [getPlayerMessages] Complément avec Supabase pour ${targetDossierRef}`);
    
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 2a. pending_signals
    const { data: signals } = await supabase
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", targetDossierRef)
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
                created_at: histMsg.created_at,
                sender: "player",
                sender_name: "Moi",
                document_url: null,
              });
            }
          }
        }
      }
    }

    // 2b. communication_replies
    const { data: replies } = await supabase
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", targetDossierRef)
      .order("created_at", { ascending: true });

    if (replies && replies.length > 0) {
      for (const reply of replies as CommunicationReply[]) {
        const converted = convertReplyToPlayerMessage(reply);
        if (converted) allMessages.push(converted);
      }
    }
    
    console.log(`💾 [getPlayerMessages] ${allMessages.length} messages totaux après fusion`);

    if (allMessages.length === 0) {
      console.log(`ℹ️ [getPlayerMessages] Aucun message trouvé pour ${targetDossierRef}`);
      return [];
    }

    // ✅ DÉDOUBLONNAGE : Éliminer les doublons par contenu + date (garder le plus récent)
    const uniqueMap = new Map<string, PlayerMessage>();
    for (const msg of allMessages) {
      const key = `${msg.content}_${normalizeDate(msg.created_at)}`;
      const existing = uniqueMap.get(key);
      if (!existing || normalizeDate(msg.created_at) > normalizeDate(existing.created_at)) {
        uniqueMap.set(key, msg);
      }
    }
    const uniqueMessages = Array.from(uniqueMap.values());

    // ✅ TRI UNIFIÉ sur TOUS les messages (du plus récent au plus ancien)
    const sortedMessages = [...uniqueMessages].sort((a, b) => {
      const dateA = normalizeDate(a.created_at);
      const dateB = normalizeDate(b.created_at);
      return dateB - dateA;
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [getPlayerMessages] ${sortedMessages.length} messages uniques retournés en ${duration}ms (tri décroissant)`);

    return sortedMessages;
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
