"use client";

import React from 'react';
import { 
  User, Lock, Eye, EyeOff, Save, Fingerprint, Phone, Hash, Mail, Globe, MapPin, LifeBuoy, RefreshCcw 
} from "lucide-react";
import Link from "next/link";

/**
 * INTERFACE LOCALE POUR LE TYPAGE DU JOUEUR
 * Alignée sur la structure "City-Aware" du Master Registry
 */
interface ProfilePlayer {
  id: string;
  dossier_ref?: string;
  email?: string;
  full_name?: string;
  country?: string;
  city?: string;
  pseudo?: string;
  phone?: string;
}

interface ProfileFormProps {
  player: ProfilePlayer;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  newPseudo: string;
  setNewPseudo: (val: string) => void;
  newPhone: string;
  setNewPhone: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  handleUpdateProfile: (e: React.FormEvent) => Promise<void>;
  updating: boolean;
  updateMessage: {type: 'success' | 'error', text: string} | null;
}

export default function ProfileForm({
  player, 
  isEditMode, 
  newPseudo, 
  setNewPseudo,
  newPhone, 
  setNewPhone, 
  newPassword, 
  setNewPassword,
  showPassword, 
  setShowPassword, 
  handleUpdateProfile,
  updating, 
  updateMessage
}: ProfileFormProps) {
  
  // Sécurisation du fallback pour l'ID afin d'éviter un crash .toUpperCase() sur undefined
  const displayId = player.dossier_ref || (player.id ? player.id.split('-')[0].toUpperCase() : "EN ATTENTE");

  return (
    <form onSubmit={handleUpdateProfile} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 pb-4 border-b border-zinc-900/50 mb-4">
        
        {/* IDENTIFIANT UNIQUE - RÉFÉRENCE GITHUB/VGD */}
        <div className="space-y-1.5 opacity-60">
          <label htmlFor="dossier_id" className="text-[9px] font-black uppercase text-red-600 tracking-widest ml-1">Vagondys ID Officielle</label>
          <div className="relative h-11">
            <Hash className="absolute left-3 top-3.5 w-4 h-4 text-red-600" />
            <input 
              id="dossier_id"
              type="text" 
              value={displayId} 
              readOnly 
              title="ID Athlète unique" 
              placeholder="ID"
              className="w-full h-full bg-black border border-zinc-900 rounded-xl py-3 pl-10 text-xs text-zinc-500 font-mono" 
            />
          </div>
        </div>

        {/* EMAIL CENTRALISÉ (NON MODIFIABLE) */}
        <div className="space-y-1.5">
          <label htmlFor="email_liaison" className="text-[9px] font-black uppercase text-red-600 tracking-widest ml-1 opacity-60">Email de Liaison (Verrouillé)</label>
          <div className="relative h-11 opacity-60">
            <Mail className="absolute left-3 top-3.5 w-4 h-4 text-red-600" />
            <input 
              id="email_liaison"
              type="email" 
              value={player.email || ""} 
              readOnly 
              title="Email de connexion sécurisé" 
              placeholder="EMAIL"
              className="w-full h-full bg-black border border-zinc-900 rounded-xl py-3 pl-10 text-xs text-zinc-500 font-bold uppercase" 
            />
          </div>
        </div>

        {/* IDENTITÉ CIVILE */}
        <div className="space-y-1.5 opacity-40">
          <label htmlFor="full_name" className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Identité Officielle (Fixe)</label>
          <div className="relative h-11">
            <User className="absolute left-3 top-3.5 w-4 h-4 text-zinc-700" />
            <input 
              id="full_name"
              type="text" 
              value={player.full_name || ""} 
              readOnly 
              title="Nom Complet Civil" 
              placeholder="NOM COMPLET"
              className="w-full h-full bg-black border border-zinc-900 rounded-xl py-3 pl-10 text-xs text-zinc-500 font-bold uppercase" 
            />
          </div>
        </div>

        {/* LOCALISATION GÉOGRAPHIQUE - GARE DE TRIAGE */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 opacity-40">
            <label htmlFor="country" className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Pays</label>
            <div className="relative h-11">
              <Globe className="absolute left-3 top-3.5 w-4 h-4 text-zinc-700" />
              <input 
                id="country"
                type="text" 
                value={player.country || "FRANCE"} 
                readOnly 
                title="Pays d'origine" 
                placeholder="PAYS"
                className="w-full h-full bg-black border border-zinc-900 rounded-xl py-3 pl-10 text-xs text-zinc-500 font-bold uppercase" 
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="city" className="text-[9px] font-black uppercase text-red-600 tracking-widest ml-1 opacity-60">Unité Locale (Station)</label>
            <div className="relative h-11 opacity-60">
              <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-red-600" />
              <input 
                id="city"
                type="text" 
                value={player.city || "NON RENSEIGNÉ"} 
                readOnly 
                title="Ville de rattachement pour la synchronisation" 
                placeholder="VILLE"
                className="w-full h-full bg-black border border-zinc-900 rounded-xl py-3 pl-10 text-xs text-zinc-500 font-black uppercase" 
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Link 
            href="/contact?subject=transfert-identite" 
            target="_blank"
            rel="noopener noreferrer"
            title="Contacter le staff pour un transfert d'identité"
            className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-600 hover:text-red-600 transition-colors mt-1"
          >
            <LifeBuoy size={10} /> Demander un transfert d&apos;identité au Staff
          </Link>
        </div>
      </div>

      {/* ZONE MODIFIABLE - ALIAS */}
      <div className={`space-y-1.5 ${!isEditMode && 'opacity-50'}`}>
        <label htmlFor="pseudo_edit" className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Alias / Pseudo</label>
        <div className="relative h-11">
          <Fingerprint className={`absolute left-3 top-3.5 w-4 h-4 ${isEditMode ? 'text-red-600' : 'text-zinc-700'}`} />
          <input 
            id="pseudo_edit"
            type="text" 
            value={newPseudo} 
            onChange={(e) => setNewPseudo(e.target.value)} 
            disabled={!isEditMode} 
            title="Modifier votre pseudonyme de jeu"
            placeholder="VOTRE PSEUDO"
            className={`w-full h-full bg-black border ${isEditMode ? 'border-red-600/50' : 'border-zinc-800'} rounded-xl py-3 pl-10 text-xs text-white outline-none font-bold uppercase`} 
          />
        </div>
      </div>

      {/* ZONE MODIFIABLE - TÉLÉPHONE */}
      <div className={`space-y-1.5 ${!isEditMode && 'opacity-50'}`}>
        <label htmlFor="phone_edit" className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Téléphone</label>
        <div className="relative h-11">
          <Phone className={`absolute left-3 top-3.5 w-4 h-4 ${isEditMode ? 'text-red-600' : 'text-zinc-700'}`} />
          <input 
            id="phone_edit"
            type="tel" 
            value={newPhone} 
            onChange={(e) => setNewPhone(e.target.value)} 
            disabled={!isEditMode} 
            title="Modifier votre numéro de téléphone"
            placeholder="06 00 00 00 00"
            className={`w-full h-full bg-black border ${isEditMode ? 'border-red-600/50' : 'border-zinc-800'} rounded-xl py-3 pl-10 text-xs text-white outline-none font-mono`} 
          />
        </div>
      </div>

      {/* ZONE MODIFIABLE - MOT DE PASSE */}
      <div className={`space-y-1.5 ${!isEditMode && 'opacity-50'}`}>
        <label htmlFor="password_edit" className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Clé d&apos;Accès</label>
        <div className="relative h-11">
          <Lock className={`absolute left-3 top-3.5 w-4 h-4 ${isEditMode ? 'text-red-600' : 'text-zinc-700'}`} />
          <input 
            id="password_edit"
            type={showPassword ? "text" : "password"} 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            disabled={!isEditMode} 
            title="Nouveau mot de passe de sécurité"
            placeholder="•••••••• (VIDE = INCHANGÉ)"
            className={`w-full h-full bg-black border ${isEditMode ? 'border-red-600/50' : 'border-zinc-800'} rounded-xl py-3 pl-10 pr-10 text-xs text-white outline-none`} 
          />
          <button 
            type="button" 
            onClick={() => setShowPassword(!showPassword)} 
            disabled={!isEditMode} 
            title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-3 top-3.5 text-zinc-700 hover:text-zinc-400"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* BOUTON DE SOUMISSION */}
      {isEditMode && (
        <button 
          type="submit" 
          disabled={updating} 
          title="Sauvegarder les changements de profil"
          className="w-full h-12 bg-white text-black hover:bg-red-600 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 mt-8"
        >
          {updating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {updating ? "SYNCHRONISATION..." : "ENREGISTRER LES MODIFICATIONS"}
        </button>
      )}

      {/* MESSAGES DE STATUT */}
      {updateMessage && (
        <div className={`text-[9px] font-black uppercase tracking-widest text-center p-3 rounded-lg border ${updateMessage.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
          {updateMessage.text}
        </div>
      )}
    </form>
  );
}
