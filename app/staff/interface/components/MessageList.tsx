"use client";

import { RefreshCcw, DatabaseBackup } from "lucide-react";
import { SignalMessage } from "../types/interface";
import MessageCard from "./MessageCard";

interface MessageListProps {
  messages: SignalMessage[];
  loading: boolean;
  expandedMessages: Set<string>;
  toggleExpand: (id: string) => void;
  setReplyingTo: (msg: SignalMessage) => void;
  fetchHistoryAndLinks: (ref: string, email: string) => void;
  handleMarkAsReadSilent: (msg: SignalMessage) => void;
  handleDeepArchive: (msg: SignalMessage) => void;
  isMarkingRead: string | null;
  isArchiving: string | null;
}

/**
 * COMPOSANT : MessageList
 * Gère le flux principal des signaux.
 * Responsabilités : États de chargement, état vide, boucle de rendu.
 */
export default function MessageList({
  messages,
  loading,
  expandedMessages,
  toggleExpand,
  setReplyingTo,
  fetchHistoryAndLinks,
  handleMarkAsReadSilent,
  handleDeepArchive,
  isMarkingRead,
  isArchiving,
}: MessageListProps) {
  
  // 1. ÉTAT DE CHARGEMENT
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
          Synchronisation avec la base de données...
        </p>
      </div>
    );
  }

  // 2. ÉTAT VIDE
  if (messages.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-neutral-900/20">
        <DatabaseBackup className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-zinc-600">
          Aucun signal détecté dans cette unité.
        </p>
      </div>
    );
  }

  // 3. AFFICHAGE DE LA LISTE
  return (
    <div className="grid gap-6">
      {messages.map((msg) => (
        <MessageCard
          key={msg.id}
          msg={msg}
          isExpanded={expandedMessages.has(msg.id)}
          onToggleExpand={() => toggleExpand(msg.id)}
          onReply={() => {
            setReplyingTo(msg);
            if (msg.dossier_ref) {
              fetchHistoryAndLinks(msg.dossier_ref, msg.payload.email);
            }
          }}
          onMarkAsRead={() => handleMarkAsReadSilent(msg)}
          onDeepArchive={() => handleDeepArchive(msg)}
          isMarkingRead={isMarkingRead === msg.id}
          isArchiving={isArchiving === msg.id}
        />
      ))}
    </div>
  );
}
