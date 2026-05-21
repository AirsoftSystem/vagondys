import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://vagondys.com'
  const staffUrl = 'https://staff.vagondys.com'

  // Liste complète des routes publiques (Vagondys Public)
  const routes: { url: string; lastModified: Date; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'always' | 'hourly' | 'yearly' | 'never'; priority: number }[] = [
    '',
    '/bareme',
    '/classements',
    '/communication',
//    '/competitions',
    '/contact',
//    '/evenementiels',
    '/joueurs',
    '/la-ligue',
//    '/leaders',
    '/maison',
    '/mentions-legales',
    '/politique-de-confidentialite',
//    '/reservations',
//    '/sponsors',
//    '/tournois',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Routes Staff (Sous-domaine Staff)
  // On liste uniquement la page de login pour l'indexation de l'entrée admin
  const staffRoutes: { url: string; lastModified: Date; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'always' | 'hourly' | 'yearly' | 'never'; priority: number }[] = [
    '/login',
  ].map((route) => ({
    url: `${staffUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const, 
    priority: 0.9, 
  }))

  return [...routes, ...staffRoutes]
}
