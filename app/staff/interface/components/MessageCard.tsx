"use client";

import { 
  Mail, Phone, Clock, MessageSquare, Archive, CheckCircle2, 
  ChevronDown, ChevronUp, User, AlertTriangle 
} from "lucide-react";
import { SignalMessage } from "../types/interface";

interface MessageCardProps {
  msg: SignalMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: () => void;
  onMarkAsRead: () => void;
  onDeepArchive: () => void;
  isMarkingRead: boolean;
  isArchiving: boolean;
}

/**
 * COMPOSANT : MessageCard
 * Gère l'affichage visuel "Cyber" d'un signal individuel.
 * Incorpore toute la logique de style, les badges de statut et les boutons d'action.
 */
export default function MessageCard({
  msg,
  isExpanded,
  onToggleExpand,
  onReply,
  onMarkAsRead,
  onDeepArchive,
  isMarkingRead,
  isArchiving
}: MessageCardProps) {
  const dateStr = new Date(msg.created_at).toLocaleString('fr-FR');
  const isUrgent = msg.payload.subject.toLowerCase().includes('urgent') || 
                   msg.payload.message.toLowerCase().includes('urgent');

  return (
    <div className={`group relative bg-black border transition-all duration-500 rounded-3xl overflow-hidden ${
      isExpanded ? "border-red-600 shadow-2xl shadow-red-900/20" : "border-white/5 hover:border-white/20"
    }`}>
      {/* Barre d'état latérale */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
        isUrgent ? "bg-red-600" : "bg-zinc-800 group-hover:bg-zinc-600"
      }`} />

      <div className="p-6">
        {/* EN-TÊTE DE LA CARTE */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${isUrgent ? "bg-red-600/10" : "bg-white/5"}`}>
              <User className={`w-6 h-6 ${isUrgent ? "text-red-600" : "text-zinc-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">
                  {msg.payload.name || `${msg.payload.firstname} ${msg.payload.lastname}`}
                </h3>
                {msg.dossier_ref && (
                  <span className="bg-white/5 border border-white/10 text-[9px] font-mono px-2 py-0.5 rounded text-zinc-400">
                    #{msg.dossier_ref}
                  </span>
                )}
                {isUrgent && (
                  <span className="flex items-center gap-1 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase animate-pulse">
                    <AlertTriangle className="w-2 h-2" /> Urgent
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-default">
                  <Mail className="w-3 h-3 text-red-600" /> {msg.payload.email}
                </span>
                {msg.payload.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-red-600" /> {msg.payload.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {dateStr}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onMarkAsRead}
              disabled={isMarkingRead}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-green-600/50 hover:text-green-500 transition-all group/btn"
              title="Marquer comme lu"
            >
              <CheckCircle2 className={`w-4 h-4 ${isMarkingRead ? "animate-pulse" : ""}`} />
            </button>
            <button 
              onClick={onToggleExpand}
              className={`p-2.5 rounded-xl border transition-all ${
                isExpanded ? "bg-red-600 border-red-600 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/20"
              }`}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* SUJET DU MESSAGE */}
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600 mb-1">Sujet du signal :</p>
          <p className="text-sm font-medium text-white italic">&quot;{msg.payload.subject}&quot;</p>
        </div>

        {/* CONTENU EXTENSIBLE */}
        {isExpanded && (
          <div className="mt-6 space-y-6 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-neutral-900/30 rounded-2xl p-6 border border-white/5">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-red-600" /> Contenu de la transmission
              </p>
              <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap font-medium">
                {msg.payload.message}
              </p>
            </div>

            {/* ACTIONS FOOTER */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <button 
                onClick={onReply}
                className="flex-1 bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all active:scale-95"
              >
                Ouvrir le canal de réponse
              </button>
              <button 
                onClick={onDeepArchive}
                disabled={isArchiving}
                className="p-4 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-500 hover:text-red-600 hover:border-red-600/50 transition-all"
                title="Archiver définitivement"
              >
                <Archive className={`w-5 h-5 ${isArchiving ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
