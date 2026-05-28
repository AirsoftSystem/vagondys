
import { getAthleteCity, getAthleteCountry } from "@/lib/supabase/master";
import { findFileInRepo, upsertFile, deleteFile } from "./gh-client";
import { getHistoryFromDB, purgeDossierData } from "./db-client";
import { normalizeForPath } from "./utils";
import { HistoryRow } from "./types";

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
  fullThread?: Array<{
    role: string;
    sender: string;
    content: string;
    created_at: string;
    is_initial?: boolean;
    details?: Record<string, unknown>;
  }>;
}

/**
 * ARCHIVE ENGINE - Version adaptée pour l'Option B
 * Utilise désormais le registry central pour obtenir la ville/pays
 */
export async function processArchivePost(body: ArchiveRequestBody) {
  const { message, history, purgeActive, city_code, country_code, fullThread: providedFullThread } = body;

  if (!message || !message.dossier_ref) {
    throw new Error("Données de dossier manquantes");
  }

  const payload = message.payload;
  const ref = message.dossier_ref;
  const newEmail = String(payload?.email || "inconnu").toLowerCase().trim();
  
  // LOGIQUE DE TRIAGE : Priorité au city_code passé explicitement
  // Sinon, tentative de récupération depuis le registry via l'email
  let rawCity = (city_code || payload?.city || "").toUpperCase().trim();
  let finalCountryCode = (country_code || "").toUpperCase().trim();
  
  // Si la ville n'est pas fournie, on tente de la récupérer depuis le registry
  if (!rawCity && newEmail !== "inconnu") {
    const registryCity = await getAthleteCity(newEmail);
    const registryCountry = await getAthleteCountry(newEmail);
    if (registryCity) {
      rawCity = registryCity.toUpperCase().trim();
      finalCountryCode = finalCountryCode || (registryCountry || "FR").toUpperCase().trim();
      console.log(`📦 Archivage: ville récupérée depuis registry: ${finalCountryCode}_${rawCity}`);
    }
  }
  
  // Fallback par défaut
  if (!rawCity) {
    rawCity = "NANTES";
  }
  
  // Normalisation du code pays
  const rawCountryName = (payload?.country || "FRANCE").toUpperCase().trim();
  if (!finalCountryCode) {
    finalCountryCode = (rawCountryName === "ESPAGNE" || rawCountryName === "ES") ? "ES" : "FR";
  }
  
  // Configuration GitHub (Repo unique pour toutes les archives)
  const targetRepo = process.env.GITHUB_ARCHIVE_REPO;
  const customToken = process.env.GITHUB_ARCHIVE_TOKEN;
  
  if (!targetRepo || !customToken) {
    throw new Error(`❌ CONFIGURATION GITHUB MANQUANTE: GITHUB_ARCHIVE_REPO et GITHUB_ARCHIVE_TOKEN doivent être définis`);
  }
  
  console.log(`📦 Archivage vers: ${targetRepo} (ville ${rawCity}/${finalCountryCode})`);

  // Préparation du chemin et du nom de fichier
  const normCountry = normalizeForPath(finalCountryCode === "ES" ? "ESPAGNE" : "FRANCE");
  const normCity = normalizeForPath(rawCity);
  const emailSlug = newEmail.replace(/[@.]/g, "_");
  
  const fileName = `${emailSlug}_${ref}.json`;
  const path = `archives/${normCountry}/${normCity}/${fileName}`;

  // Récupération de l'historique des réponses staff
  let finalHistory: HistoryRow[] = Array.isArray(history) ? history : [];
  if (finalHistory.length === 0) {
    finalHistory = await getHistoryFromDB(ref, rawCity);
  }

  // Construction du fil de discussion
  let fullThread;
  
  if (providedFullThread && providedFullThread.length > 0) {
    // ✅ Utiliser le fullThread fourni par confirm-signal (déjà complet)
    fullThread = providedFullThread;
    console.log(`📦 Archivage: utilisation du fullThread fourni (${fullThread.length} messages)`);
  } else {
    // 🔄 Fallback : reconstruction à partir des données disponibles
    const messagesHistory = payload?.messages_history || [];
    
    fullThread = [
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
      },
      // Historique des messages (si existant)
      ...messagesHistory.map((msg, index) => ({
        role: "public",
        sender: newEmail,
        content: msg.content,
        created_at: msg.created_at,
        is_initial: index === 0 && messagesHistory.length > 0
      })),
      // Réponses staff
      ...finalHistory.map((h: HistoryRow) => ({
        id: h.id,
        created_at: h.created_at,
        agent_email: h.agent_email,
        content: h.content,
        document_url: h.document_url ?? null,
        dossier_ref: h.dossier_ref ?? ref
      }))
    ].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });
    
    console.log(`📦 Archivage: reconstruction du fullThread (${fullThread.length} messages)`);
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
      city_code: rawCity,
      country_code: finalCountryCode
    },
    echanges_staff: finalHistory,
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

  const commitMsg = purgeActive 
    ? `🔒 ARCHIVAGE FINAL & PURGE : Dossier ${ref}` 
    : `🔄 SYNCHRONISATION : Dossier ${ref}`;

  const ghResponse = await upsertFile(
    customToken,
    targetRepo,
    path,
    JSON.stringify(archiveData, null, 2),
    commitMsg,
    currentSha
  );

  if (!ghResponse.ok) {
    const errText = await ghResponse.text();
    throw new Error(`Échec GitHub (${ghResponse.status}): ${errText}`);
  }

  // Purge des données locales (Optionnel)
  let purged = false;
  if (purgeActive === true) {
    console.log(`🗑️ processArchivePost: purge active pour ${ref} sur ${rawCity}/${finalCountryCode}`);
    await purgeDossierData(ref, rawCity, finalCountryCode);
    purged = true;
    console.log(`✅ processArchivePost: purge terminée pour ${ref}`);
  }

  return { success: true, purged, path, repo: targetRepo };
}
