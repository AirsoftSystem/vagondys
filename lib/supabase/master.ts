
import { createClient } from '@supabase/supabase-js';

// ==========================================================
// CONFIGURATION DU PROJET UNIFIÉ
// ==========================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * INITIALISATION SÉCURISÉE DU CLIENT
 */
const getClient = () => {
  if (!SUPABASE_URL) {
    console.warn("SUPABASE_URL manquant dans l'environnement.");
    return null;
  }
  
  // Utilise la clé publique sur le client, et la clé service sur le serveur si dispo
  const key = (typeof window === 'undefined') ? (SUPABASE_SERVICE_KEY || SUPABASE_PUBLIC_KEY) : SUPABASE_PUBLIC_KEY;
  
  if (!key) {
    console.warn("Clé de sécurité SUPABASE manquante.");
    return null;
  }

  return createClient(SUPABASE_URL, key);
};

// Client standard pour les lectures et opérations classiques
export const masterClient = getClient()!;

/**
 * CLIENT ADMIN (SERVICE ROLE)
 * Dédié exclusivement aux opérations de serveurs critiques pour bypasser les RLS
 * Accessible UNIQUEMENT côté serveur.
 */
export const masterAdmin = (typeof window === 'undefined' && SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// ==========================================================
// FONCTIONS DE GESTION DE L'ANNUAIRE ET AUTH
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
