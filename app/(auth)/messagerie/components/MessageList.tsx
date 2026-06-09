
"use client";

import React from "react";
import { Mail, Clock, ChevronRight } from "lucide-react";
import type { Conversation } from "../actions";

interface MessageListProps {
  /** Liste des conversations */
  conversations: Conversation[];
  /** Conversation sélectionnée */
  selectedConversation: Conversation | null;
  /** Callback lors de la sélection d’une conversation */
  onSelectConversation: (conversation: Conversation) => void;
  /** État de chargement */
  loading?: boolean;
}

/**
 * Composant d’affichage de la liste des conversations
 * Affiche chaque conversation avec le nom du correspondant, dernier message, date et compteur de non lus
 */
export default function MessageList({
  conversations,
  selectedConversation,
  onSelectConversation,
  loading = false,
}: MessageListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-zinc-900">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 animate-pulse">
            <div className="flex justify-between items-start mb-1">
              <div className="h-3 w-24 bg-zinc-800 rounded" />
              <div className="h-4 w-4 bg-zinc-800 rounded-full" />
            </div>
            <div className="h-2 w-32 bg-zinc-800 rounded mt-2" />
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 w-2 bg-zinc-800 rounded" />
              <div className="h-2 w-16 bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <Mail className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
          Aucune conversation
        </p>
        <p className="text-[7px] text-zinc-700 mt-2">
          Utilisez le formulaire de contact pour initier un échange
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-900 max-h-[60vh] overflow-y-auto">
      {conversations.map((conv) => (
        <button
          key={conv.dossier_ref}
          onClick={() => onSelectConversation(conv)}
          className={`w-full p-4 text-left transition-all hover:bg-white/5 ${
            selectedConversation?.dossier_ref === conv.dossier_ref
              ? "bg-red-600/10 border-l-2 border-red-600"
              : ""
          }`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className="text-[11px] font-black uppercase text-white">
              {conv.participant_name}
            </span>
            {conv.unread_count > 0 && (
              <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                {conv.unread_count}
              </span>
            )}
          </div>
          <p className="text-[9px] text-zinc-500 truncate">{conv.last_message}</p>
          <div className="flex items-center gap-2 mt-2 text-[7px] text-zinc-600 uppercase tracking-wider">
            <Clock className="w-2.5 h-2.5" />
            {new Date(conv.last_message_date).toLocaleDateString()}
            <ChevronRight className="w-2.5 h-2.5 ml-auto" />
          </div>
        </button>
      ))}
    </div>
  );
}
