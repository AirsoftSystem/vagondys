
import { createClient } from '@supabase/supabase-js';

// ==========================================================
// CONFIGURATION DU PROJET MAÎTRE (Fidèle à ton original)
// ==========================================================
const MASTER_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
const MASTER_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
const MASTER_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER;

/**
 * INITIALISATION SÉCURISÉE DU CLIENT MASTER
 */
const getMasterClient = () => {
  if (!MASTER_URL) {
    console.warn("MASTER_URL manquant dans l'environnement.");
    return null;
  }
  
  // Utilise la clé publique sur le client, et la clé service sur le serveur si dispo
  const key = (typeof window === 'undefined') ? (MASTER_SERVICE_KEY || MASTER_PUBLIC_KEY) : MASTER_PUBLIC_KEY;
  
  if (!key) {
    console.warn("Clé de sécurité MASTER manquante.");
    return null;
  }

  return createClient(MASTER_URL, key);
};

// Client standard pour les lectures et opérations classiques
export const masterClient = getMasterClient()!;

/**
 * NOUVEAU : CLIENT ADMIN MAÎTRE (SERVICE ROLE)
 * Dédié exclusivement aux opérations de serveurs critiques pour bypasser les RLS
 * Accessible UNIQUEMENT côté serveur.
 */
export const masterAdmin = (typeof window === 'undefined' && MASTER_URL && MASTER_SERVICE_KEY)
  ? createClient(MASTER_URL, MASTER_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

export interface StationConfig {
  name: string;
  city_code: string;
  country_code: string; // AJOUT : Pour l'unicité internationale
  public_url: string;
  public_anon_key: string;
  public_service_key: string;
  staff_url: string;
  staff_anon_key: string;
  staff_service_key: string;
  github_repo: string;
  github_token: string;
}

// ==========================================================
// LOGIQUE DE RÉCUPÉRATION DES CONFIGURATIONS (STATIONS)
// ==========================================================

/**
 * RÉCUPÉRATION AVEC PRIORITÉ PAYS_VILLE
 * Recherche dans le .env.local selon la nouvelle nomenclature (FR_NANTES)
 */
export async function getStationConfig(cityCode: string, countryCode: string = 'FR'): Promise<StationConfig | null> {
  const city = cityCode.toUpperCase().trim();
  const country = countryCode.toUpperCase().trim();
  
  // Clé composite pour les variables d'environnement (ex: FR_NANTES, ES_MADRID)
  const geoKey = `${country}_${city}`;

  // 1. TENTATIVE VIA LE FALLBACK .ENV.LOCAL (NOMENCLATURE PAYS_VILLE)
  const public_url = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}`] || process.env[`NEXT_PUBLIC_SUPABASE_URL_${city}`];
  const service_key = process.env[`SUPABASE_SERVICE_ROLE_KEY_${geoKey}`] || process.env[`SUPABASE_SERVICE_ROLE_KEY_${city}`];
  const anon_key = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}`] || process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${city}`];

  // ✅ AJOUT : Recherche explicite des variables STAFF (priorité absolue)
  const staff_url = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}_STAFF`] || 
                    process.env[`NEXT_PUBLIC_SUPABASE_URL_${city}_STAFF`];
  
  const staff_anon_key = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}_STAFF`] || 
                         process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${city}_STAFF`];
  
  const staff_service_key = process.env[`SUPABASE_SERVICE_ROLE_KEY_${geoKey}_STAFF`] || 
                            process.env[`SUPABASE_SERVICE_ROLE_KEY_${city}_STAFF`];

  // ✅ CORRECTION : Récupération explicite des variables GITHUB pour la ville
  // Priorité à la nomenclature PAYS_VILLE, fallback sur la ville seule
  const github_repo = process.env[`REPO_VGD_${geoKey}`] || 
                      process.env[`REPO_VGD_${city}`] || 
                      '';
  
  const github_token = process.env[`TOKEN_VGD_${geoKey}`] || 
                       process.env[`TOKEN_VGD_${city}`] || 
                       '';

  if (public_url && service_key) {
    // ✅ CORRECTION : Log pour tracer la récupération des variables GitHub
    console.log(`📦 getStationConfig: ${geoKey} -> github_repo: ${github_repo ? '✅ trouvé' : '❌ manquant'}, github_token: ${github_token ? '✅ trouvé' : '❌ manquant'}`);
    
    return {
      name: `VAGONDYS ${city} (${country})`,
      city_code: city,
      country_code: country,
      public_url: public_url.trim(),
      public_anon_key: (anon_key || '').trim(),
      public_service_key: service_key.trim(),
      // ✅ PRIORITÉ aux vraies variables STAFF, sinon fallback sur PUBLIC
      staff_url: (staff_url || public_url).trim(),
      staff_anon_key: (staff_anon_key || anon_key || '').trim(),
      staff_service_key: (staff_service_key || service_key).trim(),
      github_repo: github_repo.trim(),
      github_token: github_token.trim()
    };
  }

  // 2. TENTATIVE VIA LA BASE DE DONNÉES MASTER (Table 'stations' - Optionnel si utilisé)
  if (masterAdmin) {
    try {
      const { data, error } = await masterAdmin
        .from('stations')
        .select('*')
        .eq('city_code', city)
        .eq('country_code', country)
        .eq('is_active', true)
        .single();

      if (!error && data && data.public_url) {
        console.log(`📦 getStationConfig: ${geoKey} trouvé dans la table stations`);
        return data as StationConfig;
      }
    } catch {
      // Échec silencieux
    }
  }

  console.error(`CONFIG CRITIQUE : Localisation ${geoKey} introuvable dans le .env ou la base.`);
  return null;
}

/**
 * GÉNÉRATEUR DE CLIENT DYNAMIQUE
 */
export async function createDynamicClient(cityCode: string, countryCode: string = 'FR', type: 'PUBLIC' | 'STAFF' = 'PUBLIC') {
  const config = await getStationConfig(cityCode, countryCode);
  
  if (!config) {
    console.error(`createDynamicClient: Fallback Master pour ${countryCode}/${cityCode}`);
    return masterClient;
  }

  const url = type === 'PUBLIC' ? config.public_url : config.staff_url;
  const key = type === 'PUBLIC' ? config.public_service_key : config.staff_service_key;

  // ✅ VÉRIFICATION AMÉLIORÉE : Log détaillé pour diagnostiquer les clés invalides
  if (!url || !key || key.length < 20) {
    console.error(`🔑 CLÉ INVALIDE pour ${countryCode}/${cityCode} (type: ${type}):`, {
      url: url ? 'présente' : 'manquante',
      keyLength: key?.length || 0,
      keyPreview: key ? `${key.substring(0, 15)}...` : 'aucune'
    });
    throw new Error(`BASE_VILLE_ERROR: INVALID API KEY pour ${countryCode}/${cityCode}.`);
  }

  return createClient(url, key, {
    auth: { 
      autoRefreshToken: false, 
      persistSession: false 
    },
    db: {
      schema: 'public'
    }
  });
}

// ==========================================================
// FONCTIONS DE GESTION DE L'ANNUAIRE ET AUTH (Originales)
// ==========================================================

export async function registerAthlete(userId: string, email: string, city: string, country: string = 'FR') {
  if (!masterAdmin) throw new Error("Accès Admin Master indisponible");
  const { error } = await masterAdmin
    .from('athletes_registry')
    .insert([
      { 
        user_id: userId,
        email: email.toLowerCase(), 
        city: city.toUpperCase(),
        country: country.toUpperCase(),
        created_at: new Date().toISOString() 
      }
    ]);

  if (error) {
    console.error("Erreur Annuaire Maître:", error.message);
    throw error;
  }
}

export async function verifyEmailToken(token: string) {
  if (!masterAdmin) return null;
  const { data, error } = await masterAdmin
    .from('email_confirmations')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data;
}

export async function consumeEmailToken(token: string) {
  if (!masterAdmin) return false;
  const { error } = await masterAdmin
    .from('email_confirmations')
    .update({ 
      used: true,
      used_at: new Date().toISOString()
    })
    .eq('token', token);

  if (error) console.error("Erreur critique consumeEmailToken:", error.message);
  return !error;
}

export async function syncAthleteReference(email: string, dossierRef: string) {
  if (!masterAdmin) return false;
  const { error } = await masterAdmin
    .from('athletes_registry')
    .update({ dossier_ref: dossierRef })
    .eq('email', email.toLowerCase());

  if (error) console.error("Erreur Synchro Master Registry:", error.message);
  return !error;
}

export async function locateAthleteStation(email: string): Promise<StationConfig | null> {
  if (!masterAdmin) return null;
  const { data: registry, error } = await masterAdmin
    .from('athletes_registry') 
    .select('city, country')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !registry) return null;
  return await getStationConfig(registry.city, registry.country || 'FR');
}

export async function getAthleteCity(email: string): Promise<string | null> {
  if (!masterAdmin) return null;
  const { data, error } = await masterAdmin
    .from('athletes_registry')
    .select('city')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) return null;
  return data.city;
}

export async function getAthleteCountry(email: string): Promise<string | null> {
  if (!masterAdmin) return null;
  const { data, error } = await masterAdmin
    .from('athletes_registry')
    .select('country')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) return null;
  return data.country;
}
