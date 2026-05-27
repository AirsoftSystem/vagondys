
import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { getStationConfig, masterAdmin } from './master'
import { cookies, headers } from 'next/headers'

// ==========================================================
// CLIENT UNIFIÉ POUR L'ARCHITECTURE MULTI-VILLE
// ==========================================================
// Ce fichier centralise l'accès à Supabase en un seul point d'entrée
// Il remplace les appels dispersés à createVagondysClient, createStaffClient, etc.
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
 * Inspiré de la version fonctionnelle de server.ts
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
  
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
  
  // LOGIQUE D'AIGUILLAGE PRIORITAIRE
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

  if (activeCity) {
    const config = await getStationConfig(activeCity, activeCountry || 'FR')
    if (config) {
      if (type === 'PUBLIC') {
        url = config.public_url
        anonKey = useServiceRole ? config.public_service_key : config.public_anon_key
      } else if (type === 'STAFF') {
        url = config.staff_url
        anonKey = useServiceRole ? config.staff_service_key : config.staff_anon_key
      }
    }
  }

  return createServerClient(url, anonKey, {
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
 */
export function createUnifiedBrowserClient(options: UnifiedClientOptions = {}) {
  const { cityCode, countryCode = 'FR', type = 'PUBLIC' } = options

  const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER
  const masterKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER

  let supabaseUrl = masterUrl
  let supabaseKey = masterKey

  if (cityCode) {
    const city = cityCode.toUpperCase().trim()
    const country = countryCode.toUpperCase().trim()
    const geoKey = `${country}_${city}`

    if (type === 'PUBLIC') {
      const dynamicUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}`] || 
                         process.env[`NEXT_PUBLIC_SUPABASE_URL_${city}`]
      const dynamicKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}`] || 
                         process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${city}`]
      if (dynamicUrl) {
        supabaseUrl = dynamicUrl
        supabaseKey = dynamicKey || ""
      }
    } else if (type === 'STAFF') {
      const dynamicUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${geoKey}_STAFF`] ||
                         process.env[`NEXT_PUBLIC_SUPABASE_URL_${city}_STAFF`]
      const dynamicKey = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${geoKey}_STAFF`] ||
                         process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${city}_STAFF`]
      if (dynamicUrl && dynamicKey) {
        supabaseUrl = dynamicUrl
        supabaseKey = dynamicKey
      }
    }
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
 */
export async function createUnifiedAdminClient(cityCode: string, countryCode: string = 'FR', type: 'PUBLIC' | 'STAFF' = 'PUBLIC') {
  const config = await getStationConfig(cityCode, countryCode)
  if (!config) {
    throw new Error(`Impossible de créer le client Admin pour ${countryCode}_${cityCode}`)
  }

  const url = type === 'PUBLIC' ? config.public_url : config.staff_url
  const serviceKey = type === 'PUBLIC' ? config.public_service_key : config.staff_service_key

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
    const masterUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!
    const masterKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
    
    const supabaseAuth = createServerClient(masterUrl, masterKey, {
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
// ==========================================================

/**
 * @deprecated Utilisez createUnifiedServerClient({ type: 'PUBLIC' }) à la place
 */
export { createVagondysClient as legacyVagondysClient } from './server'

/**
 * @deprecated Utilisez createUnifiedServerClient({ type: 'STAFF' }) à la place
 */
export { createStaffClient as legacyStaffClient } from './server'

/**
 * @deprecated Utilisez createUnifiedAdminClient() à la place
 */
export { createAdminClient as legacyAdminClient } from './server'
