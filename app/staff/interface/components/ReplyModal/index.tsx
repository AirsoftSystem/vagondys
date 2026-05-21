"use client";

import { X, History, Send } from "lucide-react";
import { SignalMessage, HistoryMessage, GitHubArchiveData } from "../../types/interface";
import HistoryTimeline from "./HistoryTimeline";
import ReplyForm from "./ReplyForm";

interface ReplyModalProps {
  replyingTo: SignalMessage;
  onClose: () => void;
  userEmail: string | null;
  historyMessages: HistoryMessage[];
  loadingHistory: boolean;
  linkedDossiers: string[];
  githubArchive: GitHubArchiveData | null;
  replyContent: string;
  setReplyContent: (val: string) => void;
  documentLink: string;
  setDocumentLink: (val: string) => void;
  isSending: boolean;
  onSendReply: (e: React.FormEvent) => void;
}

/**
 * COMPOSANT : ReplyModal (Index)
 * Point d'entrée de la modale de communication.
 * Gère le layout en deux colonnes : Gauche (Historique) / Droite (Réponse).
 */
export default function ReplyModal({
  replyingTo,
  onClose,
  historyMessages,
  loadingHistory,
  linkedDossiers,
  githubArchive,
  replyContent,
  setReplyContent,
  documentLink,
  setDocumentLink,
  isSending,
  onSendReply
}: ReplyModalProps) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-8">
      {/* Overlay sombre */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Conteneur Modale */}
      <div className="relative w-full max-w-7xl h-[90vh] bg-neutral-950 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header de la Modale */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-900/20">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white">
                Canal de Réponse <span className="text-red-600">Sécurisé</span>
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                Dossier : {replyingTo.dossier_ref || "N/A"} — Destinataire : {replyingTo.payload.email}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all"
              title="Fermer la fenêtre"
              aria-label="Fermer la fenêtre de réponse">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Corps de la Modale (Deux colonnes) */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          
          {/* COLONNE GAUCHE : Historique & Timeline */}
          <div className="flex-1 border-r border-white/5 bg-zinc-950/50 overflow-y-auto custom-scrollbar">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <History className="w-5 h-5 text-red-600" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                  Chronologie des échanges
                </h3>
              </div>
              
              <HistoryTimeline 
                messages={historyMessages}
                loading={loadingHistory}
                linkedDossiers={linkedDossiers}
                githubArchive={githubArchive}
              />
            </div>
          </div>

          {/* COLONNE DROITE : Formulaire de réponse */}
          <div className="w-full lg:w-[450px] bg-black flex flex-col overflow-y-auto">
            <ReplyForm 
              replyingTo={replyingTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              documentLink={documentLink}
              setDocumentLink={setDocumentLink}
              isSending={isSending}
              onSendReply={onSendReply}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
