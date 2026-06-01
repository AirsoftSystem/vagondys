
import { createBrowserClient } from '@supabase/ssr'

/**
 * CLIENT CLIENT-SIDE UNIFIÉ : PROJET VAGONDYS (Public)
 * Version simplifiée - utilise un seul projet Supabase avec filtre city
 */
export function createVagondysClient(cityCode?: string, countryCode?: string, cityKey?: string) {
  // Récupération des variables UNIQUES (plus de MASTER)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // La ville est maintenant utilisée comme FILTRE dans les requêtes, pas pour changer de base
  if (cityCode) {
    console.log(`createVagondysClient: Connexion pour ${countryCode || 'FR'}_${cityCode} (filtre city dans les requêtes)`);
  }

  // cityKey est conservé pour compatibilité API mais non utilisé actuellement
  if (cityKey) {
    console.log(`createVagondysClient: cityKey présent mais non utilisé (conservé pour compatibilité)`);
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
 * Version UNIFIÉE - utilise le même projet Supabase avec filtre city
 */
export function createStaffClient(cityCode?: string, countryCode: string = 'FR') {
  // Récupération des variables UNIQUES (plus de MASTER)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // La ville est maintenant utilisée comme FILTRE dans les requêtes
  if (cityCode) {
    console.log(`createStaffClient: Connexion staff pour ${countryCode}_${cityCode} (filtre city dans les requêtes)`);
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
 * CLIENT CLIENT-SIDE : ADMINISTRATION (admin.vagondys.com)
 * Identique à createStaffClient, dédié au sous-domaine admin
 */
export function createAdminClient() {
  // Récupération des variables UNIQUES (plus de MASTER)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Log pour tracer l'utilisation
  console.log(`createAdminClient: Connexion admin (admin.vagondys.com)`);

  // Sécurité anti-crash
  if (!supabaseUrl || !supabaseKey) {
    console.error("VAGONDYS_ADMIN_NETWORK_ERROR: Configuration Supabase Admin manquante pour l'initialisation du client.");
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
    file_url?: string | null;
    file_key?: string | null;
    dossier_ref: string;
  }>;
  fil_de_discussion: Array<{
    role: string;
    sender: string;
    content: string;
    created_at: string;
    document_url?: string | null;
    file_url?: string | null;
    file_key?: string | null;
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
 * ✅ MODIFICATION : countryCode n'a plus de valeur par défaut (undefined si non fourni)
 */
export async function fetchGitHubArchive(
  dossierRef: string, 
  cityCode?: string, 
  countryCode?: string
): Promise<GitHubArchiveData | null> {
  try {
    // Construction de l'URL avec les paramètres optionnels
    let url = `/api/archive-external?ref=${encodeURIComponent(dossierRef)}`;
    
    if (cityCode) {
      url += `&city_code=${encodeURIComponent(cityCode.toUpperCase())}`;
    }
    if (countryCode) {
      url += `&country_code=${encodeURIComponent(countryCode.toUpperCase())}`;
    }
    
    console.log(`📦 fetchGitHubArchive: recherche ${dossierRef} avec city=${cityCode || 'non spécifiée'}, country=${countryCode || 'non spécifié'}`);
    
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
