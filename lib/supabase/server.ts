import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { getStationConfig } from './master'
import { createClient } from '@supabase/supabase-js'

/**
 * CLIENT MASTER ADMIN (SERVEUR UNIQUEMENT)
 * Pour les opérations critiques sur le Cerveau (Auth, Registry)
 */
export const masterAdminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
  process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER!
)

/**
 * CLIENT SERVEUR DYNAMIQUE : PUBLIC / JOUEURS
 * Permet d'accéder aux données d'une ville spécifique (Nantes, Lyon, etc.)
 * Adapté pour la nomenclature internationale (Pays + Ville)
 */
export async function createVagondysClient(cityCode?: string, countryCode?: string) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
  
  // LOGIQUE D'AIGUILLAGE PRIORITAIRE
  let activeCity = cityCode || headerStore.get('x-vgd-city')
  let activeCountry = countryCode || headerStore.get('x-vgd-country')

  // AUTO-RÉSOLUTION VIA SESSION SI DONNÉES MANQUANTES
  if (!activeCity || !activeCountry) {
    const supabaseAuth = createServerClient(url, anonKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch {} },
      },
    })
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (user?.user_metadata) {
      activeCity = activeCity || user.user_metadata.city
      activeCountry = activeCountry || user.user_metadata.country
    }
  }

  if (activeCity) {
    // Utilisation du duo Ville + Pays pour récupérer la config correcte (ex: FR + NANTES)
    const config = await getStationConfig(activeCity, activeCountry || 'FR')
    if (config) {
      url = config.public_url
      anonKey = config.public_anon_key
    }
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })
}

/**
 * CLIENT SERVEUR DYNAMIQUE : STAFF (VERSION CORRIGÉE)
 * Connecte le membre du staff à la base de gestion de sa ville.
 * Cette version utilise désormais uniquement les paramètres cityCode/countryCode
 * pour charger la bonne config, sans dépendre des headers.
 */
export async function createStaffClient(cityCode?: string, countryCode?: string) {
  const cookieStore = await cookies()
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
  
  // La ville est maintenant fournie en paramètre (provenant de la Server Action)
  const activeCity = cityCode
  const activeCountry = countryCode || 'FR'

  if (activeCity) {
    const config = await getStationConfig(activeCity, activeCountry)
    if (config) {
      // Utiliser les identifiants STAFF spécifiques
      url = config.staff_url
      anonKey = config.staff_anon_key
    } else {
      console.warn(`createStaffClient: Aucune config trouvée pour ${activeCountry}_${activeCity}. Utilisation du MASTER.`)
    }
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })
}

/**
 * CLIENT SERVEUR ADMIN DYNAMIQUE (Service Role)
 * Indispensable pour que le serveur puisse écrire/modifier les données 
 */
export async function createAdminClient(cityCode: string, countryCode: string = 'FR', type: 'PUBLIC' | 'STAFF' = 'PUBLIC') {
  const config = await getStationConfig(cityCode, countryCode)
  if (!config) throw new Error(`Impossible de créer le client Admin pour ${countryCode}_${cityCode}`)

  const url = type === 'PUBLIC' ? config.public_url : config.staff_url
  const serviceKey = type === 'PUBLIC' ? config.public_service_key : config.staff_service_key

  return createClient(url, serviceKey)
}
