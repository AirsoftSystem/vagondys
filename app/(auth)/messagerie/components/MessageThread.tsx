
"use client";

import React from "react";
import { User, Mail, Clock, Link as LinkIcon, RefreshCcw } from "lucide-react";
import type { Message, Conversation } from "../actions";

interface MessageThreadProps {
  /** Conversation sélectionnée */
  conversation: Conversation | null;
  /** Liste des messages */
  messages: Message[];
  /** État de chargement des messages */
  loading?: boolean;
  /** Callback pour rafraîchir (optionnel) */
  onRefresh?: () => void;
}

/**
 * Composant d’affichage du fil de discussion
 * Messages client à droite, staff à gauche
 */
export default function MessageThread({
  conversation,
  messages,
  loading = false,
  onRefresh,
}: MessageThreadProps) {
  // Pas de conversation sélectionnée
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Mail className="w-12 h-12 text-zinc-800 mb-4" />
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
          Sélectionnez une conversation
        </p>
        <p className="text-[8px] text-zinc-700 mt-1">
          pour consulter vos échanges
        </p>
      </div>
    );
  }

  // Chargement
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCcw className="w-6 h-6 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* En-tête de la conversation */}
      <div className="p-4 border-b border-zinc-900 bg-black/30 shrink-0">
        <h3 className="text-xs font-black uppercase tracking-wider text-white">
          {conversation.participant_name}
        </h3>
        <p className="text-[8px] text-zinc-500 font-mono mt-0.5">
          Référence : {conversation.dossier_ref}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-2 text-[7px] text-zinc-600 hover:text-red-600 uppercase tracking-wider flex items-center gap-1 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCcw className="w-3 h-3" />
            Rafraîchir
          </button>
        )}
      </div>

      {/* Zone des messages */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
              Aucun message dans cette conversation
            </p>
            <p className="text-[7px] text-zinc-700 mt-2">
              Soyez le premier à envoyer un message
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.sender === "user";
            const isStaff = msg.sender === "staff";
            
            return (
              <div
                key={msg.id || idx}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    isUser
                      ? "bg-red-600/20 border border-red-600/30"
                      : isStaff
                      ? "bg-zinc-900 border border-zinc-800"
                      : "bg-zinc-800/50 border border-zinc-700 italic"
                  }`}
                >
                  {/* En-tête du message : expéditeur + date */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User className="w-2.5 h-2.5 text-zinc-500" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                        {msg.sender_name}
                      </span>
                    </div>
                    <span className="text-[6px] text-zinc-600">•</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-2 h-2 text-zinc-600" />
                      <span className="text-[7px] text-zinc-600">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Contenu du message */}
                  <p className="text-[11px] text-white leading-relaxed whitespace-pre-wrap wrap-break-word">
                    {msg.content}
                  </p>

                  {/* Fichier joint */}
                  {msg.document_url && (
                    <a
                      href={msg.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[8px] text-red-600 hover:text-red-500 uppercase tracking-wider transition-colors"
                    >
                      <LinkIcon className="w-3 h-3" />
                      Voir le fichier joint
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
