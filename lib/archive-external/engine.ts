
import { getStationConfig } from "@/lib/supabase/master";
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
    };
    // CORRECTION : unknown remplace any pour la flexibilité
    [key: string]: unknown; 
  };
  history?: HistoryRow[];
  purgeActive?: boolean;
  city_code?: string;
}

/**
 * ARCHIVE ENGINE
 */
export async function processArchivePost(body: ArchiveRequestBody) {
  const { message, history, purgeActive, city_code } = body;

  if (!message || !message.dossier_ref) {
    throw new Error("Données de dossier manquantes");
  }

  // Cast sécurisé pour les variables dynamiques issues du payload
  const payload = message.payload;
  const ref = message.dossier_ref;
  
  // LOGIQUE GARE DE TRIAGE : Priorité au city_code passé explicitement
  const rawCity = (city_code || payload?.city || "NANTES").toUpperCase().trim();
  const rawCountryName = (payload?.country || "FRANCE").toUpperCase().trim();

  // NORMALISATION DU CODE PAYS (Crucial pour getStationConfig)
  // Permet de passer de "ESPAGNE" à "ES" pour viser ES_MADRID dans le .env.local
  const countryCode = (rawCountryName === "ESPAGNE" || rawCountryName === "ES") ? "ES" : "FR";

  // ✅ CORRECTION : Récupération OBLIGATOIRE de la config de la station
  // Plus de fallback Master par défaut - on exige la config de la ville
  const config = await getStationConfig(rawCity, countryCode);
  
  if (!config) {
    throw new Error(`❌ CONFIGURATION INTROUVABLE : Aucune station trouvée pour ${countryCode}_${rawCity}`);
  }
  
  // ✅ CORRECTION : FORCER l'utilisation du dépôt GitHub de la ville
  // Si la ville n'a pas de github_repo configuré, c'est une erreur
  if (!config.github_repo || !config.github_token) {
    throw new Error(`❌ CONFIGURATION GITHUB MANQUANTE pour ${countryCode}_${rawCity}. github_repo: ${!!config.github_repo}, github_token: ${!!config.github_token}`);
  }
  
  // ✅ CORRECTION : Utilisation EXCLUSIVE des identifiants de la ville
  const targetRepo = config.github_repo;
  const customToken = config.github_token;
  
  console.log(`📦 Archivage vers: ${targetRepo} (ville ${rawCity}/${countryCode})`);

  // 2. Préparation du chemin et du nom de fichier
  const normCountry = normalizeForPath(rawCountryName);
  const normCity = normalizeForPath(rawCity);
  const newEmail = String(payload?.email || "inconnu").toLowerCase().trim();
  const emailSlug = newEmail.replace(/[@.]/g, "_");
  
  // Le nom de fichier utilise le matricule VGD-XXXX
  const fileName = `${emailSlug}_${ref}.json`;
  const path = `archives/${normCountry}/${normCity}/${fileName}`;

  // 3. Récupération de l'historique
  // On transmet rawCity pour interroger la base STAFF de la ville concernée
  let finalHistory: HistoryRow[] = Array.isArray(history) ? history : [];
  if (finalHistory.length === 0) {
    finalHistory = await getHistoryFromDB(ref, rawCity);
  }

  // 4. Construction du fil de discussion complet
  const fullThread = [
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
    {
      role: "public",
      sender: newEmail,
      content: payload?.message || "OUVERTURE DU DOSSIER D'ENRÔLEMENT",
      created_at: message.created_at || new Date().toISOString(),
      is_initial: true
    },
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

  // 5. Structure de l'archive JSON
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
      country_code: countryCode
    },
    echanges_staff: finalHistory,
    fil_de_discussion: fullThread,
    date_archivage: new Date().toISOString(),
    archive_by: "VAGONDYS_AUTO_SYSTEM",
    security_version: "1.5"
  };

  // 6. Gestion GitHub (Recherche et Mise à jour)
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

  // 7. Purge des données locales (Optionnel)
  let purged = false;
  if (purgeActive === true) {
    await purgeDossierData(ref, rawCity);
    purged = true;
  }

  return { success: true, purged, path, repo: targetRepo };
}
