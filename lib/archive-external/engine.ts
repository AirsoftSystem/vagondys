
import { getAthleteCity, getAthleteCountry } from "@/lib/supabase/master";
import { findFileInRepo, upsertFile, deleteFile } from "./gh-client";
import { getHistoryFromDB } from "./db-client";
import { normalizeForPath } from "./utils";
import { HistoryRow } from "./types";
import { gzipSync, gunzipSync } from 'zlib';
import { createClient } from "@supabase/supabase-js";

/**
 * Interface étendue locale pour supporter file_url/file_key
 * (en attendant la mise à jour de types.ts)
 */
interface ExtendedHistoryRow extends HistoryRow {
  file_url?: string | null;
  file_key?: string | null;
}

/**
 * Interface pour un message dans le fil de discussion
 */
interface ThreadMessage {
  role?: string;
  sender?: string;
  content?: string;
  created_at?: string;
  is_initial?: boolean;
  details?: Record<string, unknown>;
  id?: string;
  agent_email?: string;
  document_url?: string | null;
  file_url?: string | null;
  file_key?: string | null;
  dossier_ref?: string;
}

/**
 * Interface pour l'archive complète
 */
interface FullArchiveData {
  reference: string;
  client_identity: {
    nom?: string;
    email?: string;
    telephone?: string;
    sujet?: string;
  };
  dossier_complet: {
    dossier_ref: string;
    created_at?: string;
    payload?: {
      city?: string;
      country?: string;
      email?: string;
      name?: string;
      phone?: string;
      subject?: string;
      message?: string;
      messages_history?: Array<{ content: string; created_at: string }>;
      original_subject?: string;
      confirmed_at?: string;
      meta?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  echanges_staff: HistoryRow[];
  fil_de_discussion: ThreadMessage[];
  date_archivage: string;
  archive_by: string;
  security_version: string;
}

/**
 * Interface corrigée : on utilise unknown au lieu de any
 * pour satisfaire les règles de sécurité TypeScript.
 */
interface ArchiveRequestBody {
  message: {
    dossier_ref: string;
    created_at?: string;
    payload?: {
      city?: string;
      country?: string;
      email?: string;
      name?: string;
      phone?: string;
      subject?: string;
      message?: string;
      messages_history?: Array<{
        content: string;
        created_at: string;
      }>;
    };
    [key: string]: unknown; 
  };
  history?: HistoryRow[];
  purgeActive?: boolean;
  city_code?: string;
  country_code?: string;
  fullThread?: ThreadMessage[];
}

/**
 * Télécharge et décompresse une archive existante depuis GitHub
 */
async function fetchExistingArchive(
  ref: string,
  token: string,
  repo: string,
  cityCode?: string,
  countryCode?: string
): Promise<FullArchiveData | null> {
  try {
    const targetFile = await findFileInRepo(ref, token, repo, "archives", countryCode);
    if (!targetFile) return null;
    
    const fileRes = await fetch(targetFile.download_url);
    if (!fileRes.ok) return null;
    
    let archiveData: FullArchiveData;
    if (targetFile.name.endsWith('.gz')) {
      const arrayBuffer = await fileRes.arrayBuffer();
      const decompressed = gunzipSync(Buffer.from(arrayBuffer));
      archiveData = JSON.parse(decompressed.toString('utf8'));
    } else {
      archiveData = await fileRes.json();
    }
    
    return archiveData;
  } catch (err) {
    console.warn(`⚠️ fetchExistingArchive: impossible de récupérer l'archive pour ${ref}:`, err);
    return null;
  }
}

/**
 * ✅ CORRECTION : Fusionne deux historiques de messages en gardant un seul message par contenu (le plus récent)
 * Cela évite les doublons comme "Demande d'inscription au Tournoi" avec deux dates différentes
 */
function mergeMessagesHistory(
  existing: Array<{ content: string; created_at: string }>,
  incoming: Array<{ content: string; created_at: string }>
): Array<{ content: string; created_at: string }> {
  // Utiliser le contenu comme clé, garder le message avec la date la plus récente
  const map = new Map<string, { content: string; created_at: string }>();
  
  // Fonction pour ajouter un message en gardant le plus récent
  const addMessage = (msg: { content: string; created_at: string }) => {
    const existing = map.get(msg.content);
    if (!existing || new Date(msg.created_at).getTime() > new Date(existing.created_at).getTime()) {
      map.set(msg.content, msg);
    }
  };
  
  existing.forEach(addMessage);
  incoming.forEach(addMessage);
  
  // Convertir en tableau et trier par date (croissant)
  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  console.log(`📦 mergeMessagesHistory: ${existing.length} + ${incoming.length} → ${merged.length} messages (dédupliqué par contenu)`);
  
  return merged;
}

/**
 * Fusionne deux fils de discussion sans doublons
 */
function mergeFullThread(
  existing: ThreadMessage[],
  incoming: ThreadMessage[]
): ThreadMessage[] {
  const map = new Map<string, ThreadMessage>();
  
  // Clé unique basée sur date + contenu + expéditeur
  const getKey = (msg: ThreadMessage): string => {
    const date = msg.created_at || '';
    const content = msg.content || '';
    const sender = msg.agent_email || msg.sender || '';
    return `${date}_${content}_${sender}`;
  };
  
  // Ajouter les messages existants
  existing.forEach(msg => {
    const key = getKey(msg);
    if (!map.has(key)) {
      map.set(key, msg);
    }
  });
  
  // Ajouter les nouveaux messages
  incoming.forEach(msg => {
    const key = getKey(msg);
    if (!map.has(key)) {
      map.set(key, msg);
    }
  });
  
  // Convertir en tableau et trier par date (croissant)
  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateA - dateB;
  });
  
  return merged;
}

/**
 * Fusionne deux listes de réponses staff sans doublons
 */
function mergeStaffReplies(
  existing: HistoryRow[],
  incoming: HistoryRow[]
): HistoryRow[] {
  const map = new Map<string, HistoryRow>();
  
  // Clé unique basée sur id (priorité) ou date + contenu + agent_email
  existing.forEach(reply => {
    if (reply.id) {
      map.set(reply.id, reply);
    } else {
      const key = `${reply.created_at}_${reply.content}_${reply.agent_email}`;
      map.set(key, reply);
    }
  });
  
  incoming.forEach(reply => {
    if (reply.id && !map.has(reply.id)) {
      map.set(reply.id, reply);
    } else if (!reply.id) {
      const key = `${reply.created_at}_${reply.content}_${reply.agent_email}`;
      if (!map.has(key)) {
        map.set(key, reply);
      }
    }
  });
  
  return Array.from(map.values());
}

/**
 * Élimine les doublons dans un tableau de messages
 * Utilise une Map basée sur le contenu + date + agent_email
 */
function deduplicateMessages(messages: ThreadMessage[]): ThreadMessage[] {
  const uniqueMap = new Map<string, ThreadMessage>();
  
  for (const msg of messages) {
    // Créer une clé unique basée sur le contenu, la date et l'expéditeur
    const contentKey = msg.content ? msg.content.substring(0, 200) : '';
    const dateKey = msg.created_at || '';
    const senderKey = msg.agent_email || msg.sender || '';
    const key = `${contentKey}_${dateKey}_${senderKey}`;
    
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, msg);
    }
  }
  
  return Array.from(uniqueMap.values());
}

/**
 * ✅ NOUVELLE FONCTION : Purge les données locales après archivage réussi
 * Supprime le signal et les réponses staff de la base Supabase
 * pour libérer de l'espace (vision "gare de triage")
 */
async function purgeLocalData(ref: string, archiveCity: string): Promise<{ pending_signals: boolean; communication_replies: boolean }> {
  const result = { pending_signals: false, communication_replies: false };
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn(`⚠️ purgeLocalData: Impossible de purger, configuration Supabase manquante`);
      return result;
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const cityUpper = archiveCity.toUpperCase().trim();
    
    // 1. Purger pending_signals
    const { error: pendingError, count: pendingCount } = await supabaseAdmin
      .from("pending_signals")
      .delete()
      .eq("dossier_ref", ref)
      .eq("city", cityUpper);
    
    if (pendingError) {
      console.error(`❌ purgeLocalData: Erreur suppression pending_signals pour ${ref}:`, pendingError);
    } else {
      result.pending_signals = true;
      console.log(`✅ purgeLocalData: pending_signals supprimé pour ${ref} (${pendingCount} ligne(s))`);
    }
    
    // 2. Purger communication_replies
    const { error: repliesError, count: repliesCount } = await supabaseAdmin
      .from("communication_replies")
      .delete()
      .eq("dossier_ref", ref);
    
    if (repliesError) {
      console.error(`❌ purgeLocalData: Erreur suppression communication_replies pour ${ref}:`, repliesError);
    } else {
      result.communication_replies = true;
      console.log(`✅ purgeLocalData: communication_replies supprimé pour ${ref} (${repliesCount} ligne(s))`);
    }
    
    return result;
    
  } catch (err) {
    console.error(`❌ purgeLocalData: Exception pour ${ref}:`, err);
    return result;
  }
}

/**
 * ARCHIVE ENGINE - Version adaptée pour l'Option B
 * Utilise désormais le registry central pour obtenir la ville/pays
 * ✅ AJOUT : Dédoublonnage des messages et compression GZIP
 * ✅ CORRECTION : Utilisation de la ville du payload pour le chemin d'archivage
 * ✅ CORRECTION : Suppression des entrées en double dans communication_replies lors de l'archivage
 * ✅ NOUVELLE CORRECTION : Fusion avec l'archive existante au lieu d'ignorer ou écraser
 * ✅ NOUVELLE CORRECTION : mergeMessagesHistory garde un seul message par contenu (le plus récent)
 * ✅ AJOUT : Support de file_url et file_key dans l'archive
 * ✅ AJOUT : Support des tables de messagerie privée (pending_messagerie_requests, messagerie_accounts, etc.)
 * ✅ NOUVELLE CORRECTION : purgeLocalData après archivage réussi si purgeActive === true
 */
export async function processArchivePost(body: ArchiveRequestBody) {
  // city_code et country_code sont extraits mais non utilisés pour l'archivage
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { message, history, purgeActive, city_code, country_code, fullThread: providedFullThread } = body;

  if (!message || !message.dossier_ref) {
    throw new Error("Données de dossier manquantes");
  }

  const payload = message.payload;
  const ref = message.dossier_ref;
  const newEmail = String(payload?.email || "inconnu").toLowerCase().trim();
  
  // ✅ CORRECTION : La ville pour le chemin d'archivage vient du payload (la vraie ville de l'athlète)
  // city_code est utilisé pour le routage (MASTER pour les admins), mais PAS pour l'archivage
  let archiveCity = (payload?.city || "").toUpperCase().trim();
  let archiveCountry = (payload?.country || "").toUpperCase().trim();
  
  // Si la ville n'est pas dans le payload, on tente de la récupérer depuis le registry
  if (!archiveCity && newEmail !== "inconnu") {
    const registryCity = await getAthleteCity(newEmail);
    const registryCountry = await getAthleteCountry(newEmail);
    if (registryCity) {
      archiveCity = registryCity.toUpperCase().trim();
      archiveCountry = archiveCountry || (registryCountry || "FR").toUpperCase().trim();
      console.log(`📦 Archivage: ville récupérée depuis registry: ${archiveCountry}_${archiveCity}`);
    }
  }
  
  // Fallback par défaut
  if (!archiveCity) {
    archiveCity = "NANTES";
  }
  
  // Normalisation du code pays
  const rawCountryName = (payload?.country || "FRANCE").toUpperCase().trim();
  if (!archiveCountry) {
    archiveCountry = (rawCountryName === "ESPAGNE" || rawCountryName === "ES") ? "ES" : "FR";
  }
  
  // Configuration GitHub (Repo unique pour toutes les archives)
  const targetRepo = process.env.GITHUB_ARCHIVE_REPO;
  const customToken = process.env.GITHUB_ARCHIVE_TOKEN;
  
  if (!targetRepo || !customToken) {
    throw new Error(`❌ CONFIGURATION GITHUB MANQUANTE: GITHUB_ARCHIVE_REPO et GITHUB_ARCHIVE_TOKEN doivent être définis`);
  }
  
  console.log(`📦 Archivage vers: ${targetRepo} (ville archivage: ${archiveCity}/${archiveCountry})`);

  // Préparation du chemin et du nom de fichier (basé sur la VRAIE ville de l'athlète)
  const normCountry = normalizeForPath(archiveCountry === "ES" ? "ESPAGNE" : "FRANCE");
  const normCity = normalizeForPath(archiveCity);
  const emailSlug = newEmail.replace(/[@.]/g, "_");
  
  // ✅ Utilisation de l'extension .json.gz pour la compression
  const fileName = `${emailSlug}_${ref}.json.gz`;
  const path = `archives/${normCountry}/${normCity}/${fileName}`;

  console.log(`📦 Archivage: chemin complet = ${path}`);

  // 🔄 NOUVELLE CORRECTION : Récupérer l'archive existante si elle existe
  let existingArchive: FullArchiveData | null = null;
  if (!purgeActive) {
    existingArchive = await fetchExistingArchive(ref, customToken, targetRepo, archiveCity, archiveCountry);
    if (existingArchive) {
      console.log(`📦 Archivage: archive existante trouvée pour ${ref}, fusion des données`);
    }
  }

  // Récupération de l'historique des réponses staff
  let finalHistory: HistoryRow[] = Array.isArray(history) ? history : [];
  if (finalHistory.length === 0) {
    finalHistory = await getHistoryFromDB(ref, archiveCity);
  }
  
  // ✅ FUSION avec l'archive existante si présente
  if (existingArchive) {
    // Fusionner messages_history (avec dédoublonnage par contenu)
    const existingMessagesHistory = existingArchive.dossier_complet?.payload?.messages_history || [];
    const incomingMessagesHistory = payload?.messages_history || [];
    const mergedMessagesHistory = mergeMessagesHistory(existingMessagesHistory, incomingMessagesHistory);
    
    // Mettre à jour le payload avec l'historique fusionné
    if (payload) {
      payload.messages_history = mergedMessagesHistory;
    }
    
    // Fusionner echanges_staff
    const existingReplies = existingArchive.echanges_staff || [];
    const mergedReplies = mergeStaffReplies(existingReplies, finalHistory);
    finalHistory = mergedReplies;
    
    console.log(`📦 Archivage: fusion effectuée - messages: ${existingMessagesHistory.length} + ${incomingMessagesHistory.length} → ${mergedMessagesHistory.length}, réponses: ${existingReplies.length} → ${mergedReplies.length}`);
  }

  // Construction du fil de discussion avec dédoublonnage
  let fullThread: ThreadMessage[];
  
  if (providedFullThread && providedFullThread.length > 0) {
    // ✅ Utiliser le fullThread fourni mais le dédoublonner
    fullThread = deduplicateMessages(providedFullThread);
    console.log(`📦 Archivage: utilisation du fullThread fourni (${providedFullThread.length} messages, ${fullThread.length} après dédoublonnage)`);
  } else {
    // 🔄 Fallback : reconstruction à partir des données disponibles
    const messagesHistory = payload?.messages_history || [];
    
    // Créer un tableau temporaire pour la reconstruction
    const tempThread: ThreadMessage[] = [
      {
        role: "CLIENT_CONTACT_INFO",
        sender: "SYSTEM",
        content: `Fiche Contact : ${payload?.name} | Tel: ${payload?.phone || "Non renseigné"} | Email: ${newEmail}`,
        created_at: message.created_at || new Date().toISOString(),
        details: {
          name: payload?.name,
          phone: payload?.phone,
          email: newEmail,
          subject: payload?.subject
        }
      },
      // Message initial
      {
        role: "public",
        sender: newEmail,
        content: payload?.message || "OUVERTURE DU DOSSIER D'ENRÔLEMENT",
        created_at: message.created_at || new Date().toISOString(),
        is_initial: messagesHistory.length === 0
      }
    ];
    
    // Ajouter l'historique des messages client (sans doublons)
    const clientMessages: ThreadMessage[] = messagesHistory.map((msg, index) => ({
      role: "public",
      sender: newEmail,
      content: msg.content,
      created_at: msg.created_at,
      is_initial: index === 0 && messagesHistory.length > 0
    }));
    
    // Ajouter les réponses staff avec support file_url/file_key (via interface étendue)
    const staffMessages: ThreadMessage[] = finalHistory.map((h: ExtendedHistoryRow) => ({
      id: h.id,
      created_at: h.created_at,
      agent_email: h.agent_email,
      content: h.content,
      document_url: h.document_url ?? null,
      file_url: h.file_url ?? null,
      file_key: h.file_key ?? null,
      dossier_ref: h.dossier_ref ?? ref
    }));
    
    // Fusionner et dédoublonner
    const combined = [...tempThread, ...clientMessages, ...staffMessages];
    fullThread = deduplicateMessages(combined);
    
    // Trier par date
    fullThread.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });
    
    console.log(`📦 Archivage: reconstruction du fullThread (${combined.length} messages, ${fullThread.length} après dédoublonnage)`);
  }
  
  // ✅ FUSION du fullThread avec l'archive existante si présente
  if (existingArchive && existingArchive.fil_de_discussion) {
    fullThread = mergeFullThread(existingArchive.fil_de_discussion, fullThread);
    console.log(`📦 Archivage: fullThread fusionné (${existingArchive.fil_de_discussion.length} + ${fullThread.length} après fusion)`);
  }

  // Structure de l'archive JSON
  const archiveData = {
    reference: ref,
    client_identity: {
      nom: payload?.name,
      email: newEmail,
      telephone: payload?.phone || "N/A",
      sujet: payload?.subject || "ENRÔLEMENT ATHLÈTE"
    },
    dossier_complet: {
      ...message,
      city_code: archiveCity,
      country_code: archiveCountry
    },
    echanges_staff: deduplicateMessages(finalHistory.map((h: ExtendedHistoryRow) => ({
      id: h.id,
      created_at: h.created_at,
      agent_email: h.agent_email,
      content: h.content,
      document_url: h.document_url ?? null,
      file_url: h.file_url ?? null,
      file_key: h.file_key ?? null,
      dossier_ref: h.dossier_ref ?? ref
    }))),
    fil_de_discussion: fullThread,
    date_archivage: new Date().toISOString(),
    archive_by: "VAGONDYS_AUTO_SYSTEM",
    security_version: "1.5"
  };

  // Gestion GitHub (Recherche et Mise à jour)
  const existingFile = await findFileInRepo(ref, customToken, targetRepo);
  let currentSha: string | undefined;

  if (existingFile) {
    if (existingFile.path !== path) {
      console.log(`📦 Archivage: déplacement de ${existingFile.path} vers ${path}`);
      await deleteFile(
        customToken, 
        targetRepo, 
        existingFile.path, 
        existingFile.sha, 
        `🔄 NETTOYAGE : Déplacement vers ${path}`
      );
    } else {
      currentSha = existingFile.sha;
    }
  }

  // ✅ COMPRESSION GZIP du fichier avant upload
  const jsonString = JSON.stringify(archiveData, null, 2);
  const compressed = gzipSync(jsonString);
  const originalSize = jsonString.length;
  const compressedSize = compressed.length;
  
  console.log(`📦 Archivage: compression GZIP - original: ${originalSize} bytes, compressé: ${compressedSize} bytes (gain: ${((1 - compressedSize/originalSize) * 100).toFixed(1)}%)`);

  const commitMsg = purgeActive 
    ? `🔒 ARCHIVAGE FINAL & PURGE : Dossier ${ref}` 
    : `🔄 SYNCHRONISATION : Dossier ${ref}`;

  // ✅ Upload du fichier compressé (en base64)
  const ghResponse = await upsertFile(
    customToken,
    targetRepo,
    path,
    compressed.toString('base64'),
    commitMsg,
    currentSha
  );

  if (!ghResponse.ok) {
    const errText = await ghResponse.text();
    throw new Error(`Échec GitHub (${ghResponse.status}): ${errText}`);
  }

  // ✅ NOUVELLE CORRECTION : Purge locale APRÈS archivage réussi si demandé
  let purgeResult = { pending_signals: false, communication_replies: false };
  
  if (purgeActive === true) {
    console.log(`🗑️ processArchivePost: Purge locale demandée pour ${ref}, suppression des données dans Supabase...`);
    purgeResult = await purgeLocalData(ref, archiveCity);
    console.log(`🗑️ processArchivePost: Purge terminée pour ${ref} - pending_signals: ${purgeResult.pending_signals}, communication_replies: ${purgeResult.communication_replies}`);
  } else {
    console.log(`📦 processArchivePost: Archivage terminé avec succès pour ${ref} (aucune purge locale)`);
  }

  return { 
    success: true, 
    purged: purgeActive === true, 
    purgeResult,
    path, 
    repo: targetRepo, 
    compressed: true, 
    originalSize, 
    compressedSize 
  };
}
