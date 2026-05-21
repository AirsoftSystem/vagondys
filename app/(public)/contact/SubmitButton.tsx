"use client";

import React from 'react';
import { useFormStatus } from "react-dom";
import { Send, Loader2 } from "lucide-react";

/**
 * COMPOSANT : SubmitButton
 * Utilise le hook useFormStatus pour gérer l'état de soumission
 * sans avoir besoin de passer des props manuellement depuis le formulaire parent.
 * * IMPORTANT : Ce composant doit impérativement être un enfant direct ou indirect 
 * d'une balise <form> pour que useFormStatus fonctionne correctement.
 */
export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`
        w-full h-[60px] flex items-center justify-center gap-3
        font-black uppercase tracking-[0.3em] transition-all duration-300
        shadow-lg active:scale-[0.98] disabled:cursor-not-allowed
        ${pending 
          ? "bg-zinc-800 text-zinc-500 opacity-70 shadow-none" 
          : "bg-red-600 text-white hover:bg-white hover:text-black shadow-red-600/20 hover:shadow-white/10 group"
        }
      `}
    >
      {pending ? (
        <>
          {/* Animation de chargement pour le feedback visuel immédiat */}
          <Loader2 className="w-5 h-5 animate-spin text-red-600" />
          <span className="text-[10px] sm:text-xs tracking-[0.2em]">Transmission en cours...</span>
        </>
      ) : (
        <>
          <span className="text-[10px] sm:text-xs">Envoyer le signal</span>
          {/* Effet de translation sur l'icône au survol pour dynamiser l'UI */}
          <Send className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </>
      )}
    </button>
  );
}
