
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * CLIENT MASTER ADMIN (SERVEUR UNIQUEMENT)
 * Pour les opérations critiques sur le Cerveau (Auth, Registry)
 */
export const masterAdminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * CLIENT SERVEUR : PUBLIC / JOUEURS
 * Version unifiée - utilise un seul projet Supabase avec filtre city
 */
export async function createVagondysClient(cityCode?: string, countryCode?: string) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // Récupération de la ville depuis les paramètres, headers ou session
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

  // Stocker la ville active dans les headers de la réponse pour les prochaines requêtes
  const response = createServerClient(url, anonKey, {
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

  return response
}

/**
 * CLIENT SERVEUR : STAFF (VERSION UNIFIÉE)
 * Connecte le membre du staff à la base de gestion de sa ville.
 * Utilise désormais le même projet Supabase avec filtre city.
 */
export async function createStaffClient(cityCode?: string, countryCode?: string) {
  const cookieStore = await cookies()
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // La ville est maintenant fournie en paramètre (provenant de la Server Action)
  // ou sera utilisée comme filtre dans les requêtes
  const activeCity = cityCode
  const activeCountry = countryCode || 'FR'

  if (activeCity) {
    console.log(`createStaffClient: Connexion staff pour ${activeCountry}_${activeCity} (filtre city dans les requêtes)`)
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
 * CLIENT SERVEUR ADMIN (Service Role)
 * Indispensable pour que le serveur puisse écrire/modifier les données
 * Version unifiée - utilise le même projet Supabase
 */
export async function createAdminClient(cityCode: string, countryCode: string = 'FR', type: 'PUBLIC' | 'STAFF' = 'PUBLIC') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !serviceKey) {
    throw new Error(`Impossible de créer le client Admin: variables d'environnement manquantes`)
  }

  console.log(`createAdminClient: Connexion admin pour ${countryCode}_${cityCode} (type: ${type}) - filtre city dans les requêtes`)

  return createClient(url, serviceKey)
}
