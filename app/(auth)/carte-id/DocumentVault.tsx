
"use client";

import React from 'react';
import { 
  FileCheck, RefreshCcw, Upload, ChevronDown, Download, CloudLightning, ShieldCheck, Trash2 
} from "lucide-react";

// Type pour les documents R2 (à aligner avec le type du parent)
interface R2Document {
  id: string;
  document_key: string;
  document_url: string;
  category: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

/**
 * INTERFACES DE TYPAGE STRICT
 */
interface GitHubFile {
  name: string;
  download_url: string;
  path: string;
}

interface GitHubArchiveResponse {
  dossier: {
    id: string;
    created_at: string;
  };
  files: GitHubFile[];
}

interface VaultPlayer {
  id: string;
  city?: string | null; 
  documents_urls?: string[] | null;
}

interface DocumentVaultProps {
  player: VaultPlayer | null;
  githubDocs: GitHubArchiveResponse | null;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  isUploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  // NOUVELLES PROPS
  r2Documents?: R2Document[];
  isLoadingDocs?: boolean;
  onDeleteDocument?: (documentKey: string) => Promise<void>;
}

export default function DocumentVault({
  player, 
  githubDocs, 
  selectedCategory, 
  setSelectedCategory, 
  isUploading, 
  handleFileUpload,
  r2Documents = [],
  isLoadingDocs = false,
  onDeleteDocument
}: DocumentVaultProps) {

  // SÉCURITÉ ANTI-CRASH : Si le player n'est pas encore chargé
  if (!player) {
    return (
      <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-zinc-900 animate-pulse">
        <div className="flex items-center gap-3">
          <RefreshCcw className="w-4 h-4 text-zinc-800 animate-spin" />
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700">Initialisation du coffre-fort...</p>
        </div>
      </div>
    );
  }

  // Détermination sécurisée du tag de la ville
  const cityTag = player.city ? player.city.toUpperCase() : "STATION";

  // Formatage de la taille du fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Formatage de la date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Nom de la catégorie en français
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      'PI': 'Pièce d\'Identité',
      'JUSTIFICATIF_DOMICILE': 'Justificatif Domicile',
      'CHARTE': 'Charte',
      'INSCRIPTION_TOURNOI': 'Inscription Tournoi',
      'GAIN': 'Relevé de Gains',
      'AUTRE': 'Autre'
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileCheck className="w-5 h-5 text-red-600" />
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
            Coffre-fort Digital <span className="text-zinc-600 ml-1">[{cityTag}]</span>
          </h4>
        </div>
        <label 
          htmlFor="file_upload"
          title={`Ajouter un document au coffre-fort ${cityTag}`}
          className="cursor-pointer bg-zinc-900 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-zinc-800"
        >
          {isUploading ? <RefreshCcw size={10} className="animate-spin" /> : <Upload size={10} />}
          {isUploading ? "Sync..." : "Upload"}
          <input 
            id="file_upload"
            type="file" 
            title="Sélectionner le fichier" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isUploading} 
          />
        </label>
      </div>

      <div className="relative">
        <label htmlFor="doc_category" className="sr-only">Catégorie de document</label>
        <select 
          id="doc_category"
          value={selectedCategory}
          title="Catégorie du document à téléverser"
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer focus:border-red-600 text-white"
        >
          <option value="PI">Pièce d&apos;Identité</option>
          <option value="JUSTIFICATIF_DOMICILE">Justificatif de Domicile</option>
          <option value="CHARTE">Charte Vagondys</option>
          <option value="INSCRIPTION_TOURNOI">Inscriptions Tournois</option>
          <option value="GAIN">Relevés de Gains</option>
          <option value="AUTRE">Autres Documents</option>
        </select>
        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        
        {/* DOCUMENTS R2 (NOUVEAU STOCKAGE) */}
        {isLoadingDocs ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCcw className="w-4 h-4 text-red-600 animate-spin" />
            <span className="text-[8px] text-zinc-500 ml-2">Chargement des documents...</span>
          </div>
        ) : r2Documents.length > 0 ? (
          r2Documents.map((doc) => (
            <div 
              key={doc.id} 
              className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl group"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                <FileCheck size={12} className="text-red-600 shrink-0" />
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white truncate">
                    {doc.original_filename || `DOC_${cityTag}`}
                  </span>
                  <div className="flex gap-2 text-[8px] text-zinc-500">
                    <span>{getCategoryLabel(doc.category)}</span>
                    <span>•</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a 
                  href={doc.document_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  title={`Ouvrir ${doc.original_filename}`}
                  className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                >
                  <Download size={12} />
                </a>
                {onDeleteDocument && (
                  <button
                    onClick={() => onDeleteDocument(doc.document_key)}
                    title="Supprimer le document"
                    className="p-1.5 text-zinc-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 opacity-20">
            <CloudLightning className="w-6 h-6 mx-auto mb-2" />
            <p className="text-[8px] font-black uppercase">Aucun document dans le coffre-fort</p>
            <p className="text-[7px] text-zinc-600 mt-1">Utilisez le bouton Upload pour ajouter des documents</p>
          </div>
        )}

        {/* SÉPARATEUR ARCHIVES (si des documents R2 ET des archives GitHub existent) */}
        {r2Documents.length > 0 && githubDocs && githubDocs.files && githubDocs.files.length > 0 && (
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black/40 px-2 text-[7px] text-zinc-600 uppercase tracking-wider">Archives historiques</span>
            </div>
          </div>
        )}

        {/* DOCUMENTS ARCHIVÉS (GITHUB - HAUTE SÉCURITÉ) - À conserver pour l'historique */}
        {githubDocs && githubDocs.files && Array.isArray(githubDocs.files) && githubDocs.files.length > 0 && (
          githubDocs.files.map((file: GitHubFile, idx: number) => (
            <div key={`gh-${idx}`} className="flex items-center justify-between p-3 bg-red-600/5 border border-red-600/20 rounded-xl group">
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                <ShieldCheck size={12} className="text-red-600 shrink-0" />
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-500 truncate">
                    ARCHIVE_OFFICIELLE
                  </span>
                  <span className="text-[7px] text-red-500/50 truncate">
                    {file.name}
                  </span>
                </div>
              </div>
              <a 
                href={file.download_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                title={`Télécharger l'archive GitHub ${idx + 1}`}
                className="p-1.5 text-red-500 hover:text-white transition-colors shrink-0"
              >
                <Download size={12} />
              </a>
            </div>
          ))
        )}
      </div>

      {/* Info supplémentaire sur le stockage R2 */}
      {r2Documents.length > 0 && (
        <div className="text-center pt-2 border-t border-zinc-900">
          <p className="text-[6px] text-zinc-600 uppercase tracking-wider">
            Documents sécurisés via Cloudflare R2 • Chiffrement AES-256
          </p>
        </div>
      )}
    </div>
  );
}
