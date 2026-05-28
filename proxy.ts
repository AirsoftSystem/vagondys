
// proxy.ts

// createServerClient n'est pas utilisé dans ce fichier (conservé pour compatibilité future)
// import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getAthleteCity, getAthleteCountry } from './lib/supabase/master'

/**
 * PROXY / MIDDLEWARE - VERSION NEXT.JS 16 (VERCEL)
 * Gestion du routage entre le site Public et le sous-domaine Staff.
 * + PROTECTION RENFORCÉE DE L'ARBORESCENCE
 * Version adaptée pour l'Option B (un seul projet Supabase)
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl
  
  // Création de la réponse de base
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ============================================================
  // 🖥️ RÈGLE 0 - ULTRA PRIORITAIRE : ÉCRANS TV (LIVE_CONTROLS)
  // DOIT ÊTRE LE PREMIER BLOC - AUCUNE AUTRE CONDITION AVANT
  // ============================================================
  if (pathname.startsWith('/staff/live_controls')) {
    console.log(`🖥️ Écran TV: ${pathname} - accès direct (aucune transformation)`)
    // Retourner la réponse immédiatement sans aucune modification
    return response
  }

  /**
   * RÈGLE 0.5 : PROTECTION DES FICHIERS STATIQUES (IMAGES, ETC.)
   * Ne rien faire sur les ressources statiques
   */
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|json|map)$/)) {
    return response
  }

  /**
   * RÈGLE 1 : PROTECTION DE L'ARBORESCENCE
   * Bloque l'accès direct aux fichiers sensibles
   */
  const blockedPatterns = [
    // Fichiers de configuration (exacts)
    '/package.json',
    '/package-lock.json',
    '/next.config.ts',
    '/next.config.js',
    '/tsconfig.json',
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.env.development',
    '/vercel.json',
    '/middleware.ts',
    '/proxy.ts',
    '/eslint.config.mjs',
    '/postcss.config.mjs',
    '/tailwind.config.ts',
    '/generate-test-logs.mjs',
    
    // Dossiers système
    '/.next/',
    '/.vercel/',
    '/.vscode/',
    '/node_modules/',
    '/.git/',
    '/.github/',
    
    // Dossiers source internes (non routables)
    '/lib/',
    '/scripts/',
    
    // Fichiers de documentation
    '/README.md',
    '/arborescence.txt',
    '/VAGONDYS_TEST_DATA',
  ]

  const isBlocked = blockedPatterns.some(pattern => {
    if (pattern.startsWith('/')) {
      return pathname === pattern
    } else if (pattern.endsWith('/')) {
      return pathname.startsWith(pattern)
    } else if (pattern.startsWith('.')) {
      return pathname.endsWith(pattern)
    }
    return false
  })

  if (isBlocked) {
    console.log(`🚫 Accès bloqué: ${pathname} (protection arborescence)`)
    return new NextResponse('Accès interdit', { 
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  }

  /**
   * RÈGLE 2 : EN-TÊTES DE SÉCURITÉ GLOBAUX
   */
  response.headers.set('X-Robots-Tag', 'index, follow')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  /**
   * RÈGLE 3 : PROTECTION DE L'ESPACE AUTHENTIFIÉ (SUR DOMAINE PUBLIC)
   * Version adaptée pour l'Option B (un seul projet Supabase)
   */
  if (pathname.startsWith('/espace-joueur') || pathname.startsWith('/carte-id')) {
    // ✅ IMPORT DYNAMIQUE pour éviter les problèmes de build
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ proxy: Variables Supabase manquantes')
      return NextResponse.redirect(new URL('/connexion', request.url))
    }
    
    const supabaseDefault = createClient(supabaseUrl, supabaseAnonKey)
    
    // Récupérer la session depuis le cookie
    const { data: { user } } = await supabaseDefault.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/connexion', request.url))
    }

    // Récupération de la ville et du pays depuis le registry
    const city = await getAthleteCity(user.email!)
    const country = await getAthleteCountry(user.email!)
    
    if (city) {
      response.headers.set('x-vgd-city', city)
      response.headers.set('x-vgd-country', country || 'FR')
    }
  }

  /**
   * RÈGLE 4 : ISOLATION DU DOMAINE PUBLIC
   */
  if (!host.includes('staff.vagondys.com')) {
    return response
  }

  /**
   * RÈGLE 5 : INITIALISATION DU CLIENT STAFF (VIA PROJET UNIQUE)
   * Version adaptée pour l'Option B
   */
  // ✅ IMPORT DYNAMIQUE pour éviter les problèmes de build
  const { createClient } = await import('@supabase/supabase-js')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ proxy: Variables Supabase manquantes pour staff')
    return NextResponse.redirect(new URL('/staff/login', request.url))
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  /**
   * RÈGLE 6 : VÉRIFICATION DE L'UTILISATEUR STAFF
   */
  const { data: { user } } = await supabase.auth.getUser()
  
  const userEmail = user?.email?.toLowerCase() || null;

  const isLoginPage = pathname.startsWith('/login') || pathname.startsWith('/staff/login')
  const isStaffRoot = pathname === '/staff' || pathname === '/staff/'
  
  // Redirection vers login si non authentifié (sauf pages autorisées)
  if (!userEmail && !isLoginPage && !isStaffRoot) {
    return NextResponse.redirect(new URL('/staff/login', request.url))
  }

  // Si c'est un staff, on injecte aussi sa localisation
  if (user) {
    const city = await getAthleteCity(userEmail!)
    const country = await getAthleteCountry(userEmail!)
    if (city) {
      response.headers.set('x-vgd-city', city)
      response.headers.set('x-vgd-country', country || 'FR')
    }
  }

  /**
   * RÈGLE 7 : RÉÉCRITURE (REWRITE) POUR LE STAFF
   */
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/staff', request.url))
  }

  // On laisse passer toutes les routes qui commencent par /staff
  if (pathname.startsWith('/staff')) {
    return response
  }

  // Réécriture pour les routes non-staff
  if (!pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    return NextResponse.rewrite(new URL(`/staff${pathname}`, request.url))
  }

  return response
}

/**
 * MATCHER : Configuration du périmètre d'action du middleware
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png|apple-touch-icon.png).*)',
  ],
}
