"use client";

import { Send, Link as LinkIcon, ShieldCheck, RefreshCcw } from "lucide-react";
import { SignalMessage } from "../../types/interface";

interface ReplyFormProps {
  replyingTo: SignalMessage;
  replyContent: string;
  setReplyContent: (val: string) => void;
  documentLink: string;
  setDocumentLink: (val: string) => void;
  isSending: boolean;
  onSendReply: (e: React.FormEvent) => void;
}

/**
 * COMPOSANT : ReplyForm
 * Gère l'interface de saisie et d'envoi des messages.
 * Inclut la gestion des pièces jointes (liens) et les indicateurs de sécurité.
 */
export default function ReplyForm({
  replyingTo,
  replyContent,
  setReplyContent,
  documentLink,
  setDocumentLink,
  isSending,
  onSendReply
}: ReplyFormProps) {
  return (
    <form onSubmit={onSendReply} className="flex-1 flex flex-col p-8 gap-8">
      {/* Zone de texte principale */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
          Transmission de la réponse
        </label>
        <textarea
          autoFocus
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder={`Écrire au sujet de : ${replyingTo.payload.subject}...`}
          className="flex-1 w-full bg-neutral-900/50 border border-white/5 rounded-[2rem] p-6 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-red-600/50 transition-all resize-none font-medium leading-relaxed custom-scrollbar"
        />
      </div>

      {/* Options de transmission & Documents */}
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-2 flex items-center gap-2">
            <LinkIcon className="w-3 h-3" /> Pièce jointe (Lien de document)
          </label>
          <input 
            type="url"
            value={documentLink}
            onChange={(e) => setDocumentLink(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-[11px] text-white focus:border-red-600 outline-none font-mono transition-all"
            placeholder="https://docs.vagondys.com/..."
          />
        </div>

        {/* Badge de sécurité et statut */}
        <div className="bg-red-600/5 p-4 rounded-xl border border-red-600/10 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-[9px] text-zinc-500 uppercase leading-relaxed font-bold tracking-tight">
            Canal sécurisé activé. La réponse sera archivée dans l&apos;historique et synchronisée avec le coffre-fort.
          </p>
        </div>

        {/* Bouton d'action principal */}
        <button 
          type="submit"
          disabled={isSending || !replyContent.trim()}
          className={`w-full group relative overflow-hidden bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-xs transition-all flex items-center justify-center gap-3 ${
            isSending 
              ? "opacity-50 cursor-not-allowed" 
              : "hover:bg-red-700 active:scale-95 shadow-xl shadow-red-900/40"
          }`}
        >
          {isSending ? (
            <>
              <RefreshCcw className="w-4 h-4 animate-spin" />
              TRANSMISSION EN COURS...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              Envoyer la transmission
            </>
          )}
        </button>
      </div>
    </form>
  );
}
