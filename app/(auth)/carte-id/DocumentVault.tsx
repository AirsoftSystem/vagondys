"use client";

import React from 'react';
import { 
  FileCheck, RefreshCcw, Upload, ChevronDown, Download, CloudLightning, ShieldCheck 
} from "lucide-react";

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
  player: VaultPlayer | null; // Autorisation du null pour éviter le crash au chargement
  githubDocs: GitHubArchiveResponse | null;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  isUploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export default function DocumentVault({
  player, 
  githubDocs, 
  selectedCategory, 
  setSelectedCategory, 
  isUploading, 
  handleFileUpload
}: DocumentVaultProps) {

  // SÉCURITÉ ANTI-CRASH : Si le player n'est pas encore chargé, on affiche un état d'attente
  // Cela empêche l'écran noir dû à l'accès de propriétés sur un objet nul.
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
        {/* DOCUMENTS LOCAUX (SPÉCIFIQUES À LA VILLE) */}
        {player.documents_urls && Array.isArray(player.documents_urls) && player.documents_urls.length > 0 ? (
          player.documents_urls.map((doc: string, index: number) => (
            <div key={`doc-${index}`} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl group">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileCheck size={12} className="text-red-600" />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 truncate">
                  DOC_{cityTag}_{index + 1}
                </span>
              </div>
              <a 
                href={doc} 
                target="_blank" 
                rel="noopener noreferrer" 
                title={`Ouvrir le document ${cityTag} ${index + 1}`} 
                className="p-1.5 text-zinc-500 hover:text-white"
              >
                <Download size={12} />
              </a>
            </div>
          ))
        ) : (!githubDocs || !githubDocs.files || githubDocs.files.length === 0) && (
          <div className="text-center py-8 opacity-20">
            <CloudLightning className="w-6 h-6 mx-auto mb-2" />
            <p className="text-[8px] font-black uppercase">Aucun fichier local</p>
          </div>
        )}

        {/* DOCUMENTS ARCHIVÉS (GITHUB - HAUTE SÉCURITÉ) */}
        {githubDocs && githubDocs.files && Array.isArray(githubDocs.files) && githubDocs.files.map((file: GitHubFile, idx: number) => (
          <div key={`gh-${idx}`} className="flex items-center justify-between p-3 bg-red-600/5 border border-red-600/20 rounded-xl group">
             <div className="flex items-center gap-3 overflow-hidden">
                <ShieldCheck size={12} className="text-red-600" />
                <span className="text-[8px] font-black uppercase tracking-widest text-red-500 truncate">ARCHIVE_OFFICIELLE_{idx + 1}</span>
              </div>
              <a 
                href={file.download_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                title={`Télécharger l'archive GitHub ${idx + 1}`}
                className="p-1.5 text-red-500 hover:text-white"
              >
                <Download size={12} />
              </a>
          </div>
        ))}
      </div>
    </div>
  );
}
