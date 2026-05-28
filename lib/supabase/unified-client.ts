
import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { masterAdmin } from './master'
import { cookies, headers } from 'next/headers'

// ==========================================================
// CLIENT UNIFIÉ POUR L'ARCHITECTURE UNIFIÉE
// ==========================================================
// Ce fichier centralise l'accès à Supabase en un seul point d'entrée
// Version simplifiée pour l'Option B (un seul projet Supabase)
// ==========================================================

export type ClientType = 'PUBLIC' | 'STAFF' | 'ADMIN'

export interface UnifiedClientOptions {
  cityCode?: string
  countryCode?: string
  type?: ClientType
  useServiceRole?: boolean
}

/**
 * CLIENT CÔTÉ SERVEUR UNIFIÉ
 * Utilise createServerClient de @supabase/ssr pour la gestion des cookies
 * Version simplifiée - un seul projet Supabase, filtre city dans les requêtes
 */
export async function createUnifiedServerClient(options: UnifiedClientOptions = {}) {
  const { 
    cityCode, 
    countryCode = 'FR', 
    type = 'PUBLIC',
    useServiceRole = false 
  } = options

  const cookieStore = await cookies()
  const headerStore = await headers()
  
  // Utilisation des variables UNIQUES (plus de MASTER)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  // Clé à utiliser selon le type et useServiceRole
  let keyToUse = anonKey
  if (useServiceRole && type !== 'ADMIN') {
    keyToUse = serviceKey
  }
  
  // LOGIQUE D'AIGUILLAGE PRIORITAIRE (pour la ville, pas pour la base)
  let activeCity = cityCode || headerStore.get('x-vgd-city')
  let activeCountry = countryCode || headerStore.get('x-vgd-country')

  // AUTO-RÉSOLUTION VIA SESSION SI DONNÉES MANQUANTES
  if (!activeCity || !activeCountry) {
    const supabaseAuth = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options })
            })
          } catch {}
        },
      },
    })
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (user?.user_metadata) {
      activeCity = activeCity || user.user_metadata.city
      activeCountry = activeCountry || user.user_metadata.country
    }
  }

  // Log pour tracer la ville active (sera utilisée comme filtre dans les requêtes)
  if (activeCity) {
    console.log(`createUnifiedServerClient: Connexion pour ${activeCountry}_${activeCity} (type: ${type}, filtre city dans les requêtes)`)
  }

  return createServerClient(url, keyToUse, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(cookie => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options })
          })
        } catch {}
      },
    },
  })
}

/**
 * CLIENT CÔTÉ NAVIGATEUR UNIFIÉ
 * Utilise createBrowserClient de @supabase/ssr
 * Version simplifiée - un seul projet Supabase
 */
export function createUnifiedBrowserClient(options: UnifiedClientOptions = {}) {
  const { cityCode, countryCode = 'FR', type = 'PUBLIC' } = options

  // Utilisation des variables UNIQUES (plus de MASTER)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Log pour tracer la ville active (sera utilisée comme filtre dans les requêtes)
  if (cityCode) {
    console.log(`createUnifiedBrowserClient: Connexion pour ${countryCode}_${cityCode} (type: ${type}, filtre city dans les requêtes)`)
  }

  if (!supabaseUrl || !supabaseKey) {
    console.warn("UnifiedBrowserClient: Configuration manquante, fallback sur placeholder")
    return createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseKey || 'placeholder'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}

/**
 * CLIENT ADMIN UNIFIÉ (Service Role)
 * Pour les opérations d'écriture critiques côté serveur uniquement
 * Version simplifiée - un seul projet Supabase
 */
export async function createUnifiedAdminClient(cityCode: string, countryCode: string = 'FR', type: 'PUBLIC' | 'STAFF' = 'PUBLIC') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !serviceKey) {
    throw new Error(`Impossible de créer le client Admin: variables d'environnement manquantes`)
  }

  console.log(`createUnifiedAdminClient: Connexion admin pour ${countryCode}_${cityCode} (type: ${type}) - filtre city dans les requêtes`)

  return createClient(url, serviceKey)
}

/**
 * UTILITAIRE : Récupérer la ville depuis les headers ou la session
 * À utiliser côté serveur uniquement
 */
export async function getCurrentCityFromRequest(): Promise<{ cityCode: string | null; countryCode: string | null }> {
  const headerStore = await headers()
  const cookieStore = await cookies()
  
  let cityCode = headerStore.get('x-vgd-city')
  let countryCode = headerStore.get('x-vgd-country')

  if (!cityCode || !countryCode) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabaseAuth = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll() {},
      },
    })
    
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (user?.user_metadata) {
      cityCode = cityCode || user.user_metadata.city || null
      countryCode = countryCode || user.user_metadata.country || null
    }
  }

  return { cityCode: cityCode || null, countryCode: countryCode || null }
}

/**
 * UTILITAIRE : Vérifier si un utilisateur peut accéder aux données d'une ville
 */
export async function canAccessCity(
  userEmail: string, 
  targetCityCode: string, 
  targetCountryCode: string = 'FR'
): Promise<boolean> {
  if (!masterAdmin) return false
  
  const { data: registry, error } = await masterAdmin
    .from('athletes_registry')
    .select('city, country, is_staff')
    .eq('email', userEmail.toLowerCase())
    .single()
  
  if (error || !registry) return false
  
  // Le staff a accès à toutes les villes
  if (registry.is_staff === true) return true
  
  // Un joueur normal ne peut accéder qu'à sa propre ville
  return registry.city?.toUpperCase() === targetCityCode.toUpperCase() &&
         (registry.country || 'FR').toUpperCase() === targetCountryCode.toUpperCase()
}

// ==========================================================
// EXPORT DES CLIENTS LÉGACY POUR LA COMPATIBILITÉ
// Ces exports permettent une transition progressive sans casser le code existant
// Note: Les fonctions legacy ne sont plus importées depuis './server' car ce fichier
// sera supprimé. Utilisez createUnifiedServerClient ou createUnifiedBrowserClient à la place.
// ==========================================================

/**
 * @deprecated Utilisez createUnifiedServerClient({ type: 'PUBLIC' }) à la place
 */
export async function legacyVagondysClient(cityCode?: string, countryCode?: string) {
  return createUnifiedServerClient({ cityCode, countryCode, type: 'PUBLIC' })
}

/**
 * @deprecated Utilisez createUnifiedServerClient({ type: 'STAFF' }) à la place
 */
export async function legacyStaffClient(cityCode?: string, countryCode?: string) {
  return createUnifiedServerClient({ cityCode, countryCode, type: 'STAFF' })
}

/**
 * @deprecated Utilisez createUnifiedAdminClient() à la place
 */
export async function legacyAdminClient(cityCode: string, countryCode: string = 'FR', type: 'PUBLIC' | 'STAFF' = 'PUBLIC') {
  return createUnifiedAdminClient(cityCode, countryCode, type)
}
