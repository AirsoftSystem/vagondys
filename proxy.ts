
// proxy.ts

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getAthleteCity, getAthleteCountry } from './lib/supabase/master'

/**
 * PROXY / MIDDLEWARE - VERSION NEXT.JS 16 (VERCEL)
 * Gestion du routage entre le site Public, le sous-domaine Staff et le sous-domaine Admin.
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
  // RÈGLE 0 : ÉCRANS TV (LIVE_CONTROLS)
  // ============================================================
  if (pathname.startsWith('/staff/live_controls')) {
    console.log(`🖥️ Écran TV: ${pathname} - accès direct`)
    return response
  }

  // ============================================================
  // RÈGLE 0.5 : PROTECTION DES FICHIERS STATIQUES
  // ============================================================
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|json|map)$/)) {
    return response
  }

  // ============================================================
  // RÈGLE 1 : PROTECTION DE L'ARBORESCENCE
  // ============================================================
  const blockedPatterns = [
    '/package.json', '/package-lock.json', '/next.config.ts', '/next.config.js',
    '/tsconfig.json', '/.env', '/.env.local', '/.env.production', '/.env.development',
    '/vercel.json', '/middleware.ts', '/proxy.ts', '/eslint.config.mjs',
    '/postcss.config.mjs', '/tailwind.config.ts', '/generate-test-logs.mjs',
    '/.next/', '/.vercel/', '/.vscode/', '/node_modules/', '/.git/', '/.github/',
    '/lib/', '/scripts/', '/README.md', '/arborescence.txt', '/VAGONDYS_TEST_DATA',
  ]

  const isBlocked = blockedPatterns.some(pattern => {
    if (pattern.startsWith('/')) return pathname === pattern
    if (pattern.endsWith('/')) return pathname.startsWith(pattern)
    if (pattern.startsWith('.')) return pathname.endsWith(pattern)
    return false
  })

  if (isBlocked) {
    console.log(`🚫 Accès bloqué: ${pathname}`)
    return new NextResponse('Accès interdit', { status: 403 })
  }

  // ============================================================
  // RÈGLE 2 : EN-TÊTES DE SÉCURITÉ GLOBAUX
  // ============================================================
  response.headers.set('X-Robots-Tag', 'index, follow')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // ============================================================
  // RÈGLE 3 : ESPACE JOUEUR / CARTE ID
  // ============================================================
  if (pathname.startsWith('/espace-joueur') || pathname.startsWith('/carte-id')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => request.cookies.get(name)?.value,
          set: (name, value, options) => {
            response.cookies.set({ name, value, ...options })
          },
          remove: (name, options) => {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/connexion', request.url))
    }

    const city = await getAthleteCity(user.email!)
    const country = await getAthleteCountry(user.email!)
    
    if (city) {
      response.headers.set('x-vgd-city', city)
      response.headers.set('x-vgd-country', country || 'FR')
    }
    
    return response
  }

  // ============================================================
  // RÈGLE 4 : ISOLATION DES SOUS-DOMAINES
  // ============================================================

  // --- SOUS-DOMAINE ADMIN ---
  if (host.includes('admin.vagondys.com')) {
    console.log(`👑 Sous-domaine admin détecté: ${host}${pathname}`)
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => request.cookies.get(name)?.value,
          set: (name, value, options) => {
            response.cookies.set({ name, value, ...options })
          },
          remove: (name, options) => {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const userEmail = user?.email?.toLowerCase() || null
    // ✅ CORRECTION : page de login à /login (pas /admin/login)
    const isAdminLoginPage = pathname === '/login'
    const isAdminApi = pathname.startsWith('/api/')
    const isAdminStatic = pathname.startsWith('/_next')
    
    // Vérifier que l'utilisateur est admin@vagondys.com
    const isAdminUser = userEmail === 'admin@vagondys.com'
    
    // ✅ CORRECTION : redirection vers /login (pas /admin/login)
    if (!isAdminUser && !isAdminLoginPage && !isAdminApi && !isAdminStatic) {
      console.log(`🔒 Admin non authentifié, redirection vers /login`)
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // ✅ CORRECTION : redirection vers /dashboard (pas /admin/dashboard)
    if (pathname === '/' || pathname === '/admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    // Réécritures pour admin
    if (pathname.startsWith('/dashboard')) {
      return response
    }
    
    return response
  }

  // --- SOUS-DOMAINE STAFF ---
  if (host.includes('staff.vagondys.com')) {
    console.log(`👔 Sous-domaine staff détecté: ${host}${pathname}`)
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => request.cookies.get(name)?.value,
          set: (name, value, options) => {
            response.cookies.set({ name, value, ...options })
          },
          remove: (name, options) => {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const userEmail = user?.email?.toLowerCase() || null
    const isStaffLoginPage = pathname === '/staff/login' || pathname === '/login'
    const isStaffApi = pathname.startsWith('/api/')
    const isStaffStatic = pathname.startsWith('/_next')
    
    // Vérifier que l'utilisateur est staff (email @vagondys.com)
    const isStaffUser = userEmail?.endsWith('@vagondys.com') === true
    
    if (!isStaffUser && !isStaffLoginPage && !isStaffApi && !isStaffStatic) {
      console.log(`🔒 Staff non authentifié, redirection vers /staff/login`)
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }
    
    if (user) {
      const city = await getAthleteCity(userEmail!)
      const country = await getAthleteCountry(userEmail!)
      if (city) {
        response.headers.set('x-vgd-city', city)
        response.headers.set('x-vgd-country', country || 'FR')
      }
    }
    
    // Règle 7 : Réécritures pour staff
    if (pathname === '/' || pathname === '/staff') {
      return NextResponse.rewrite(new URL('/staff', request.url))
    }
    
    if (pathname.startsWith('/staff')) {
      return response
    }
    
    if (!pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
      return NextResponse.rewrite(new URL(`/staff${pathname}`, request.url))
    }
    
    return response
  }

  // ============================================================
  // RÈGLE 5 : DOMAINE PUBLIC (vagondys.com)
  // ============================================================
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png|apple-touch-icon.png).*)',
  ],
}
