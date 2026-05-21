
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 🔒 SÉCURITÉ : Désactive les source maps en production
  productionBrowserSourceMaps: false,
  
  // 🔒 SÉCURITÉ : Supprime les console.log en production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 🔒 SÉCURITÉ : Headers de sécurité HTTP
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      // Headers spécifiques pour les écrans TV (live_controls)
      {
        source: '/staff/live_controls/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
  
  // 🖥️ OPTIMISATION : Configuration des routes dynamiques
  // Empêche la génération statique des pages live_controls (rendu dynamique)
  output: 'standalone', // Pour Vercel, optionnel
  
  // Permet de s'assurer que les routes dynamiques sont bien traitées
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
