import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// Force le rendu dynamique pour garantir la lecture des headers en temps réel
export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Récupération sécurisée du host pour différencier Public et Staff
  const headersList = await headers();
  const host = headersList.get('host') || '';

  // Configuration pour le sous-domaine STAFF (staff.vagondys.com)
  if (host.includes('staff')) {
    return {
      name: 'VAGONDYS Staff',
      short_name: 'VAG Staff',
      description: 'Administration de la Maison VAGONDYS',
      start_url: 'https://staff.vagondys.com/',
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#b91c1c', // Rappel du rouge admin
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

  // Configuration pour le site PUBLIC (vagondys.com)
  return {
    name: 'VAGONDYS',
    short_name: 'VAGONDYS',
    description: 'Maison d’élite d’airsoft',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
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
