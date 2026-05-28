
// actions/staff-actions.ts
'use server'

import { masterAdmin } from '@/lib/supabase/master'
import { cookies } from 'next/headers'

export async function getStaffCity(): Promise<{ city: string | null; country: string | null; email: string | null }> {
  try {
    const cookieStore = await cookies()

    // 1. Récupérer la session depuis le projet UNIQUE en utilisant le cookie de session
    const { createServerClient } = await import('@supabase/ssr')
    
    const supabaseUnique = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user }, error } = await supabaseUnique.auth.getUser()

    if (error || !user?.email) {
      console.error('[getStaffCity] Erreur auth:', error)
      return { city: null, country: null, email: null }
    }

    console.log('[getStaffCity] Utilisateur connecté:', user.email)

    let city: string | null = null
    let country: string | null = 'FR'

    // 2. Essayer de lire depuis athletes_registry (MASTER)
    // Vérifier que masterAdmin n'est pas null
    if (masterAdmin) {
      try {
        const { data: registry, error: registryError } = await masterAdmin
          .from('athletes_registry')
          .select('city, country')
          .eq('email', user.email)
          .maybeSingle() // Utiliser maybeSingle au lieu de single pour éviter l'erreur 406

        if (!registryError && registry) {
          city = registry.city
          country = registry.country || 'FR'
          console.log('[getStaffCity] Ville trouvée dans registry:', city)
        } else {
          console.log('[getStaffCity] Aucune entrée dans registry pour cet email')
        }
      } catch (registryErr) {
        console.error('[getStaffCity] Erreur lecture registry:', registryErr)
      }
    } else {
      console.log('[getStaffCity] masterAdmin non disponible, skip registry lookup')
    }

    // 3. FALLBACK : Extraire la ville depuis l'email si non trouvée dans registry
    if (!city && user.email) {
      const email = user.email.toLowerCase()
      console.log('[getStaffCity] Fallback: extraction depuis email:', email)
      
      // Cas: nantes@vagondys.com
      if (email.includes('nantes')) {
        city = 'NANTES'
        console.log('[getStaffCity] Ville extraite (nantes):', city)
      }
      // Cas: admin.nantes@vagondys.com
      else if (email.includes('.nantes')) {
        city = 'NANTES'
        console.log('[getStaffCity] Ville extraite (.nantes):', city)
      }
      else if (email.includes('lyon')) {
        city = 'LYON'
        console.log('[getStaffCity] Ville extraite (lyon):', city)
      }
      else if (email.includes('madrid')) {
        city = 'MADRID'
        country = 'ES'
        console.log('[getStaffCity] Ville extraite (madrid):', city)
      }
      else {
        // Valeur par défaut si aucune correspondance
        city = 'NANTES'
        console.log('[getStaffCity] Ville par défaut (NANTES)')
      }
    }

    // 4. Dernier fallback : ville par défaut si toujours null
    if (!city) {
      city = 'NANTES'
      console.log('[getStaffCity] Ville par défaut (NANTES) après fallback')
    }

    console.log('[getStaffCity] Résultat final:', { city, country, email: user.email })

    return {
      city,
      country,
      email: user.email,
    }

  } catch (error) {
    console.error('[getStaffCity] Erreur critique:', error)
    return { city: null, country: null, email: null }
  }
}
