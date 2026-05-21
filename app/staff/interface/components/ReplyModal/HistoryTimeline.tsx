"use client";

import { Clock, User, ShieldCheck, LinkIcon, Files, RefreshCcw } from "lucide-react";
import { HistoryMessage, GitHubArchiveData } from "../../types/interface";

interface HistoryTimelineProps {
  messages: HistoryMessage[];
  loading: boolean;
  linkedDossiers: string[];
  githubArchive: GitHubArchiveData | null;
}

/**
 * COMPOSANT : HistoryTimeline
 * Affiche le fil de discussion chronologique.
 * Gère les bulles Client/Staff, les indicateurs d'archive et les dossiers liés.
 */
export default function HistoryTimeline({
  messages,
  loading,
  linkedDossiers,
  githubArchive
}: HistoryTimelineProps) {
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <RefreshCcw className="w-6 h-6 text-red-600 animate-spin" />
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
          Extraction de la chronologie...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* SECTION DOSSIERS LIÉS */}
      {linkedDossiers.length > 0 && (
        <div className="bg-red-600/5 border border-red-600/10 rounded-2xl p-4 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Files className="w-3 h-3 text-red-600" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white">
              Dossiers liés au même client :
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {linkedDossiers.map((ref) => (
              <span key={ref} className="text-[10px] font-mono bg-black px-2 py-1 rounded border border-white/5 text-zinc-400">
                #{ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* FIL DE DISCUSSION */}
      <div className="relative space-y-6">
        {/* Ligne verticale centrale (esthétique) */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-linear-to-b from-red-600/50 via-white/5 to-transparent" />
        {messages.map((m, idx) => {
          const isClient = m.agent_email === "CLIENT";
          const isArchived = githubArchive?.echanges_staff.some(h => h.id === m.id);

          return (
            <div key={m.id || idx} className="relative pl-10">
              {/* Point de la timeline */}
              <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 bg-black z-10 ${
                isClient ? "border-zinc-700" : "border-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]"
              }`} />

              <div className={`flex flex-col ${isClient ? "items-start" : "items-end"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500">
                    {new Date(m.created_at).toLocaleString('fr-FR')}
                  </span>
                  {isArchived && (
                    <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      <ShieldCheck className="w-2 h-2" /> Archivé GitHub
                    </span>
                  )}
                </div>

                <div className={`max-w-[85%] rounded-2xl p-4 border ${
                  isClient 
                    ? "bg-zinc-900/30 border-white/5 text-zinc-300 rounded-tl-none" 
                    : "bg-red-600/5 border-red-600/20 text-white rounded-tr-none shadow-lg shadow-red-900/5"
                }`}>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                    {isClient ? <User className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3 text-red-600" />}
                    <span className="text-[9px] font-black uppercase tracking-widest italic">
                      {isClient ? "Émetteur du Signal" : `Staff : ${m.agent_email}`}
                    </span>
                  </div>
                  
                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                    {m.content}
                  </p>

                  {m.document_url && (
                    <a 
                      href={m.document_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 p-2 bg-black/50 border border-white/10 rounded-lg text-[10px] text-red-600 hover:text-white transition-colors group"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span className="font-bold uppercase tracking-widest">Document Transmis</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && !loading && (
          <div className="text-center py-10 opacity-30">
            <Clock className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
            <p className="text-[10px] font-black uppercase tracking-widest">Origine du dossier</p>
          </div>
        )}
      </div>
    </div>
  );
}
