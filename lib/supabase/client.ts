
import { createBrowserClient } from '@supabase/ssr'

/**
 * CLIENT CLIENT-SIDE DYNAMIQUE : PROJET VAGONDYS (Public)
 * Adapté pour se connecter à la structure spécifique via cityCode et countryCode
 * Utilise la nouvelle nomenclature Pays_Ville (ex: FR_NANTES)
 */
export function createVagondysClient(cityCode?: string, countryCode?: string, cityKey?: string) {
  // 1. Récupération des variables MASTER (Défaut)
  const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
  const masterKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER;

  let supabaseUrl = masterUrl;
  let supabaseKey = masterKey;

  // 2. LOGIQUE D'AIGUILLAGE AUTOMATIQUE PAYS_VILLE
  if (cityCode) {
    const city = cityCode.toUpperCase().trim();
    const country = (countryCode || 'FR').toUpperCase().trim();
    const geoKey = `${country}_${city}`;

    // Tentative de récupération via la nouvelle norme (ex: NEXT_PUBLIC_SUPABASE_URL_FR_NANTES)
    // Sinon repli sur l'ancienne (ex: NEXT_PUBLIC_SUPABASE_URL_NANTES)
    const dynamicUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}`] || process.env[`NEXT_PUBLIC_SUPABASE_URL_${city}`];
    const dynamicKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}`] || process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${city}`];

    if (dynamicUrl) {
      supabaseUrl = dynamicUrl;
      supabaseKey = dynamicKey || "";
    } 
    // Si cityCode est en fait une URL directe (cas de secours)
    else if (cityCode.startsWith('http')) {
      supabaseUrl = cityCode;
      supabaseKey = cityKey || masterKey;
    }
  }

  // Sécurité anti-crash
  if (!supabaseUrl || !supabaseKey) {
    console.warn("VAGONDYS_NETWORK_WARNING: Supabase configuration missing for client initialization.");
    return createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseKey || 'placeholder'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}

/**
 * CLIENT CLIENT-SIDE : PROJET STAFF (Gestion interne)
 * Version DYNAMIQUE : se connecte à la base STAFF d'une ville spécifique.
 */
export function createStaffClient(cityCode?: string, countryCode: string = 'FR') {
  // 1. Récupération des variables MASTER (Défaut / Fallback)
  const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
  const masterKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER;

  let supabaseUrl = masterUrl;
  let supabaseKey = masterKey;

  // 2. LOGIQUE D'AIGUILLAGE VERS LA BASE STAFF DE LA VILLE
  if (cityCode) {
    const city = cityCode.toUpperCase().trim();
    const country = countryCode.toUpperCase().trim();
    const geoKey = `${country}_${city}`;

    // Tentative de récupération via la nouvelle norme (ex: NEXT_PUBLIC_SUPABASE_URL_FR_NANTES_STAFF)
    // Note: Ces variables DOIVENT être préfixées par NEXT_PUBLIC_ pour être accessibles côté client.
    const dynamicUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}_STAFF`] ||
                       process.env[`NEXT_PUBLIC_SUPABASE_URL_${city}_STAFF`];
    const dynamicKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}_STAFF`] ||
                       process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${city}_STAFF`];

    if (dynamicUrl && dynamicKey) {
      supabaseUrl = dynamicUrl;
      supabaseKey = dynamicKey;
    } else {
      console.warn(`createStaffClient: Variables NEXT_PUBLIC_..._STAFF pour ${geoKey} introuvables. Utilisation du MASTER.`);
    }
  }

  // Sécurité anti-crash
  if (!supabaseUrl || !supabaseKey) {
    console.error("VAGONDYS_STAFF_NETWORK_ERROR: Configuration Supabase Staff manquante pour l'initialisation du client.");
    return createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseKey || 'placeholder'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}

/**
 * INTERFACES DE COHÉSION POUR LES ARCHIVES (Typage Strict)
 */
export interface GitHubArchiveData {
  dossier: {
    id: string;
    created_at: string;
    confirmed: boolean;
    is_read: boolean;
    dossier_ref: string;
    payload: {
      name: string;
      email: string;
      phone?: string;
      subject: string;
      message: string;
    };
  };
  echanges_staff: Array<{
    id: string;
    created_at: string;
    agent_email: string;
    content: string;
    document_url?: string | null; 
    dossier_ref: string;
  }>;
  fil_de_discussion: Array<{
    role: string;
    sender: string;
    content: string;
    created_at: string;
    document_url?: string | null; 
    is_initial?: boolean;
  }>;
  date_archivage: string;
  archive_by: string;
  security_version: "v1.0-contact-lock"
}

/**
 * INTERFACE ATHLÈTE ÉTENDUE (Fiche Contact & Dossier)
 */
export interface Athlete {
  id: string;
  email: string;
  full_name: string;
  pseudo: string | null;
  phone: string | null;
  rank: string;
  status: string;
  created_at: string;
  dossier_ref?: string | null;
  city?: string | null;
  country?: string | null;
  documents_urls?: string[]; 
  notes_staff?: string;      
}

/**
 * TYPE POUR LA GESTION DOCUMENTAIRE
 */
export type DocCategory = "PI" | "JUSTIFICATIF_DOMICILE" | "CHARTE" | "INSCRIPTION_TOURNOI" | "GAIN" | "AUTRE";

/**
 * UTILITAIRE DE RÉCUPÉRATION d'ARCHIVES GITHUB
 * ✅ AJOUT : Paramètres cityCode et countryCode pour cibler le bon dépôt
 */
export async function fetchGitHubArchive(
  dossierRef: string, 
  cityCode?: string, 
  countryCode: string = 'FR'
): Promise<GitHubArchiveData | null> {
  try {
    // ✅ Construction de l'URL avec les paramètres optionnels
    let url = `/api/archive-external?ref=${encodeURIComponent(dossierRef)}`;
    
    if (cityCode) {
      url += `&city_code=${encodeURIComponent(cityCode.toUpperCase())}`;
    }
    if (countryCode) {
      url += `&country_code=${encodeURIComponent(countryCode.toUpperCase())}`;
    }
    
    console.log(`📦 fetchGitHubArchive: recherche ${dossierRef} avec city=${cityCode || 'non spécifiée'}, country=${countryCode}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Archive ${dossierRef} non trouvée dans le coffre-fort.`);
      }
      return null;
    }
    
    const data = await response.json();
    return data as GitHubArchiveData;

  } catch (error) {
    console.error("Erreur lors de la lecture de l'archive GitHub:", error);
    return null;
  }
}

/**
 * NOUVEL UTILITAIRE : RECHERCHE DE RÉFÉRENCE PAR EMAIL DANS GITHUB
 */
export async function findDossierRefByEmailInGitHub(email: string): Promise<string | null> {
  try {
    const emailSlug = email.toLowerCase().trim().replace('@', '_');
    const response = await fetch(`/api/archive-external?search=${emailSlug}`);
    
    if (!response.ok) return null;
    
    const { dossier_ref } = await response.json();
    return dossier_ref || null;
  } catch (error) {
    console.error("Erreur recherche email dans GitHub:", error);
    return null;
  }
}
