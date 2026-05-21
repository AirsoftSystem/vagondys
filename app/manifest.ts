
import { MetadataRoute } from 'next'

// ✅ CORRECTION : Manifest statique (pas de force-dynamic, pas de headers)
// Le manifest doit être statique pour que le navigateur le lise correctement

export default function manifest(): MetadataRoute.Manifest {
  // Configuration pour le site PUBLIC (vagondys.com)
  // Le sous-domaine staff utilise le même manifest (peu importe)
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
    ],
  }
}
