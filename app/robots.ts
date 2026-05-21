// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/staff/',
        '/api/',
        '/espace-joueur/',
        '/carte-id/',
        '/.next/',
        '/.vercel/',
      ],
    },
    sitemap: 'https://vagondys.com/sitemap.xml',
  }
}
