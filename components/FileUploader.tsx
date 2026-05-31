
"use client";

import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Image, File, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  /** Contexte d'utilisation : 'contact' (public) ou 'staff' (authentifié) */
  context: 'contact' | 'staff';
  /** Référence du dossier (optionnel, utilisé pour l'organisation des fichiers) */
  dossierRef?: string | null;
  /** Callback appelé après upload réussi, reçoit l'URL signée et la clé */
  onUpload: (data: { url: string; key: string }) => void;
  /** Callback appelé en cas d'erreur */
  onError?: (error: string) => void;
  /** Texte personnalisé du bouton */
  buttonText?: string;
  /** Classes CSS supplémentaires */
  className?: string;
  /** Désactiver l'upload */
  disabled?: boolean;
}

/**
 * Composant d'upload de fichier vers R2 via /api/upload-temp
 * Utilisable dans le formulaire de contact (public) et l'interface staff
 */
export default function FileUploader({
  context,
  dossierRef,
  onUpload,
  onError,
  buttonText = "Joindre un fichier",
  className = "",
  disabled = false,
}: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  const getFileIcon = (extension: string) => {
    const ext = extension.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4" aria-hidden="true" />;
    // eslint-disable-next-line jsx-a11y/alt-text
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <Image className="w-4 h-4" aria-hidden="true" />;
    return <File className="w-4 h-4" aria-hidden="true" />;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation côté client
    if (!ALLOWED_TYPES.includes(file.type)) {
      const msg = `Type non supporté. Formats acceptés : PDF, JPEG, PNG, WEBP, DOC, DOCX, TXT`;
      setError(msg);
      onError?.(msg);
      return;
    }

    if (file.size > MAX_SIZE) {
      const msg = `Fichier trop volumineux (max 10 MB)`;
      setError(msg);
      onError?.(msg);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', context);
      if (dossierRef) {
        formData.append('dossierRef', dossierRef);
      }

      // Ajouter Turnstile uniquement pour le contexte public
      if (context === 'contact') {
        const turnstileToken = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value;
        if (turnstileToken) {
          formData.append('cf-turnstile-response', turnstileToken);
        }
      }

      const response = await fetch('/api/upload-temp', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      setUploadedFile({
        url: data.url,
        key: data.key,
        name: file.name,
      });

      onUpload({ url: data.url, key: data.key });

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    setError(null);
    onUpload({ url: '', key: '' });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Zone d'upload */}
      {!uploadedFile ? (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
            transition-all duration-200
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-600/50 hover:bg-red-600/5'}
            ${error ? 'border-red-600/50 bg-red-600/5' : 'border-zinc-800 bg-black/20'}
          `}
          role="button"
          tabIndex={disabled || isUploading ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={buttonText}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept={ALLOWED_TYPES.join(',')}
            disabled={disabled || isUploading}
            className="hidden"
            title={buttonText}
            aria-label={buttonText}
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" aria-hidden="true" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Upload en cours...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-zinc-600 group-hover:text-red-600 transition-colors" aria-hidden="true" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                {buttonText}
              </p>
              <p className="text-[8px] text-zinc-700 uppercase tracking-tighter">
                {ALLOWED_TYPES.map(t => t.split('/')[1]).join(', ').toUpperCase()} • MAX 10 MB
              </p>
            </div>
          )}
        </div>
      ) : (
        // Fichier uploadé - affichage
        <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center gap-3">
            {getFileIcon(uploadedFile.name.split('.').pop() || '')}
            <div className="flex flex-col">
              <span className="text-[11px] font-mono text-white truncate max-w-[200px]">
                {uploadedFile.name}
              </span>
              <a
                href={uploadedFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] text-red-600 hover:text-red-500 uppercase tracking-wider"
              >
                Voir le fichier
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1 hover:bg-red-600/20 rounded-lg transition-colors"
            title="Supprimer le fichier"
            aria-label="Supprimer le fichier"
          >
            <X className="w-4 h-4 text-zinc-500 hover:text-red-600" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <p className="text-[9px] text-red-600 uppercase tracking-wider font-bold text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
