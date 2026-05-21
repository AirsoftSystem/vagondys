
import { MetadataRoute } from 'next'

// ✅ CORRECTION : Manifest statique (pas de force-dynamic, pas de headers)
// Pour la PWA, le manifest DOIT être un fichier JSON statique
// La différenciation Public/Staff se fait via le fichier layout.tsx si nécessaire

export default function manifest(): MetadataRoute.Manifest {
  // Configuration UNIQUE pour tout le site (Public + Staff)
  // Le manifest peut être le même pour les deux, seules les URLs changent
  return {
    name: 'VAGONDYS',
    short_name: 'VAGONDYS',
    description: 'Maison d’élite d’airsoft',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#b91c1c',
    icons: [
      {
        src: '/logo/vagondys-mark-icon.png',
        sizes: '800x800',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/logo/vagondys-mark-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo/vagondys-mark-icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
    orientation: 'portrait',
    prefer_related_applications: false,
    categories: ['sports', 'games', 'entertainment'],
  }
}
