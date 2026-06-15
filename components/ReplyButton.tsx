
"use client";

import React from 'react';
import { MessageSquare, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ReplyButtonProps {
  playerName: string;
  playerEmail: string;
  playerPhone: string;
  playerDossierRef: string;
  playerCity: string;
  variant?: 'default' | 'compact';
  className?: string;
  autoFetch?: boolean;
  signalId?: string;
}

/**
 * BOUTON RÉPONSE - Pré-remplit le formulaire de contact
 * Avec les informations du joueur
 * 
 * @example
 * // Utilisation simple
 * <ReplyButton
 *   playerName="Martin Jean"
 *   playerEmail="martin@example.com"
 *   playerPhone="+33612345678"
 *   playerDossierRef="VGD-ABCD1234"
 *   playerCity="NANTES"
 * />
 * 
 * @example
 * // Version compacte pour les tableaux
 * <ReplyButton
 *   playerName="Martin Jean"
 *   playerEmail="martin@example.com"
 *   playerPhone="+33612345678"
 *   playerDossierRef="VGD-ABCD1234"
 *   playerCity="NANTES"
 *   variant="compact"
 * />
 */
export default function ReplyButton({
  playerName,
  playerEmail,
  playerPhone,
  playerDossierRef,
  playerCity,
  variant = 'default',
  className = '',
  autoFetch = false,
  signalId
}: ReplyButtonProps) {
  
  const [loading, setLoading] = React.useState(false);

  // Construction de l'URL avec tous les paramètres pré-remplis
  const buildContactUrl = (data: {
    name: string;
    email: string;
    phone: string;
    dossier_ref: string;
    city: string;
  }) => {
    return `/contact?prefill=1&name=${encodeURIComponent(data.name)}&email=${encodeURIComponent(data.email)}&phone=${encodeURIComponent(data.phone)}&dossier=${encodeURIComponent(data.dossier_ref)}&city=${encodeURIComponent(data.city.toUpperCase())}`;
  };

  // URL directe (sans fetch)
  const directUrl = buildContactUrl({
    name: playerName,
    email: playerEmail,
    phone: playerPhone,
    dossier_ref: playerDossierRef,
    city: playerCity
  });

  // Si autoFetch est activé et qu'on a un signalId, on peut récupérer les données
  const handleAutoFetchClick = async (e: React.MouseEvent) => {
    if (!autoFetch || !signalId) {
      // Pas d'auto-fetch, laisser le lien normal fonctionner
      return;
    }
    
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`/api/get-athlete-data/${signalId}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      // ✅ CORRECTION : On utilise directement data sans stocker dans fetchedData
      const url = buildContactUrl(data);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      // Fallback : utiliser les données passées en props
      const url = buildContactUrl({
        name: playerName,
        email: playerEmail,
        phone: playerPhone,
        dossier_ref: playerDossierRef,
        city: playerCity
      });
      window.open(url, '_blank');
    } finally {
      setLoading(false);
    }
  };

  // Version compacte (pour les tableaux, messages, etc.)
  if (variant === 'compact') {
    if (autoFetch && signalId) {
      return (
        <button
          onClick={handleAutoFetchClick}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] bg-red-600 text-white hover:bg-white hover:text-black transition-all rounded-sm ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              CHARGEMENT...
            </>
          ) : (
            <>
              <MessageSquare className="w-3 h-3" />
              RÉPONDRE
              <ExternalLink className="w-2 h-2 opacity-50" />
            </>
          )}
        </button>
      );
    }
    
    return (
      <Link
        href={directUrl}
        target="_blank"
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] bg-red-600 text-white hover:bg-white hover:text-black transition-all rounded-sm ${className}`}
      >
        <MessageSquare className="w-3 h-3" />
        RÉPONDRE
        <ExternalLink className="w-2 h-2 opacity-50" />
      </Link>
    );
  }

  // Version par défaut (plus grande, pour les pages de détail)
  if (autoFetch && signalId) {
    return (
      <button
        onClick={handleAutoFetchClick}
        disabled={loading}
        className={`inline-flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] bg-red-600 text-white hover:bg-white hover:text-black transition-all shadow-lg active:scale-[0.98] ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            RÉCUPÉRATION...
          </>
        ) : (
          <>
            <MessageSquare className="w-4 h-4" />
            CONTACTER LE JOUEUR
            <ExternalLink className="w-3 h-3 opacity-70" />
          </>
        )}
      </button>
    );
  }

  return (
    <Link
      href={directUrl}
      target="_blank"
      className={`inline-flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] bg-red-600 text-white hover:bg-white hover:text-black transition-all shadow-lg active:scale-[0.98] ${className}`}
    >
      <MessageSquare className="w-4 h-4" />
      CONTACTER LE JOUEUR
      <ExternalLink className="w-3 h-3 opacity-70" />
    </Link>
  );
}
