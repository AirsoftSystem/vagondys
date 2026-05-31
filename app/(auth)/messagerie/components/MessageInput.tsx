
"use client";

import React, { useState } from "react";
import { Send, RefreshCcw, Paperclip } from "lucide-react";
import FileUploader from "@/components/FileUploader";

interface MessageInputProps {
  /** Référence du dossier pour l’upload */
  dossierRef: string | null;
  /** Envoi du message */
  onSend: (content: string, fileUrl?: string, fileKey?: string) => Promise<void>;
  /** Désactiver l’input (ex: chargement) */
  disabled?: boolean;
  /** Placeholder personnalisé */
  placeholder?: string;
}

/**
 * Composant de saisie de message avec upload de fichiers intégré
 */
export default function MessageInput({
  dossierRef,
  onSend,
  disabled = false,
  placeholder = "Saisissez votre message...",
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [uploadedFileKey, setUploadedFileKey] = useState<string>("");

  const handleSend = async () => {
    if (!message.trim() && !uploadedFileUrl) return;
    if (isSending) return;

    setIsSending(true);
    try {
      await onSend(message, uploadedFileUrl || undefined, uploadedFileKey || undefined);
      setMessage("");
      setUploadedFileUrl("");
      setUploadedFileKey("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (data: { url: string; key: string }) => {
    setUploadedFileUrl(data.url);
    setUploadedFileKey(data.key);
  };

  const isDisabled = disabled || isSending;

  return (
    <div className="border-t border-zinc-900 p-4 bg-black/40">
      {/* Zone d’upload (visible uniquement si dossierRef existe) */}
      {dossierRef && (
        <div className="mb-3">
          <FileUploader
            context="staff"
            dossierRef={dossierRef}
            onUpload={handleFileUpload}
            buttonText="Joindre un fichier"
            disabled={isDisabled}
          />
        </div>
      )}

      {/* Zone de saisie */}
      <div className="flex gap-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          disabled={isDisabled}
          className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-red-600 outline-none transition-colors resize-none placeholder:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled || (!message.trim() && !uploadedFileUrl)}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 rounded-xl transition-all flex items-center justify-center"
          title="Envoyer le message"
          aria-label="Envoyer le message"
        >
          {isSending ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Indicateur de fichier attaché */}
      {uploadedFileUrl && (
        <div className="mt-2 text-[8px] text-green-500 uppercase tracking-wider flex items-center gap-1">
          <Paperclip className="w-3 h-3" />
          1 fichier joint
        </div>
      )}

      {/* Note de sécurité */}
      <p className="text-[7px] text-zinc-700 uppercase tracking-wider mt-2 text-center">
        Tous les échanges sont chiffrés et archivés
      </p>
    </div>
  );
}
