"use client";

import { useState } from "react";
import { 
  Settings, 
  User, 
  Mail, 
  ShieldAlert, 
  Search, 
  RefreshCcw, 
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Fingerprint
} from "lucide-react";
import Link from "next/link";
import { type Athlete } from "@/lib/supabase/client";
import { searchAthleteAction } from "./actions";

// Extension locale pour garantir la présence de l'email
interface StaffTargetAthlete extends Athlete {
  email: string; 
}

export default function StaffSettingsPage() {
  // États pour la recherche
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundAthlete, setFoundAthlete] = useState<StaffTargetAthlete | null>(null);

  // États pour le transfert d'identité
  const [newEmail, setNewEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  /**
   * RECHERCHE D'UN ATHLÈTE
   * Utilise la Server Action pour éviter les erreurs de Proxy/Middleware
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSearch = searchTerm.trim(); 
    if (!cleanSearch) return;
    
    setIsSearching(true);
    setFoundAthlete(null);
    setStatus(null);

    try {
      // APPEL DE L'ACTION SERVEUR DIRECTE
      const data = await searchAthleteAction(cleanSearch);

      if (!data) {
        setStatus({ type: 'error', message: "ATHLÈTE INTROUVABLE DANS LA BASE." });
        return;
      }
      
      setFoundAthlete(data as StaffTargetAthlete);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ERREUR DE RECHERCHE.";
      setStatus({ type: 'error', message: errorMessage.toUpperCase() });
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * TRANSFERT D'IDENTITÉ (ACTION CRITIQUE)
   * Appelle la route API Admin pour modifier Auth, DB, GitHub et Gmail
   */
  const handleIdentityTransfer = async () => {
    if (!foundAthlete || !newEmail.trim()) return;
    
    const confirmTransfer = confirm(
      `SÉCURITÉ : Confirmez-vous le transfert d'identité de [${foundAthlete.pseudo}] vers [${newEmail.toLowerCase()}] ?`
    );
    
    if (!confirmTransfer) return;

    setIsUpdating(true);
    setStatus(null);

    try {
      const targetEmail = newEmail.toLowerCase().trim();

      // Appel de la Route API (route.ts) gérant les privilèges Admin
      const response = await fetch("/api/staff/notify-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: foundAthlete.id,
          newEmail: targetEmail,
          pseudo: foundAthlete.pseudo
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "ERREUR SERVEUR");

      setStatus({ 
        type: 'success', 
        message: "VALIDATION RÉALISÉE : L'IDENTITÉ A ÉTÉ MISE À JOUR ET LE COMPTE EST ACTIF." 
      });
      
      // Mise à jour locale de l'affichage
      setFoundAthlete({ ...foundAthlete, email: targetEmail });
      setNewEmail("");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "ÉCHEC CRITIQUE";
      setStatus({ type: 'error', message: errorMsg.toUpperCase() });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-neutral-100 px-6 py-24 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-12">
          <Link href="/staff" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={14} /> Dashboard Staff
          </Link>
          <div className="flex items-center gap-3 text-red-600">
            <Settings className="w-5 h-5" />
            <h1 className="text-xl font-black uppercase tracking-tighter text-white">Administration Système</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          
          {/* MOTEUR DE RECHERCHE */}
          <section className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-xl">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 mb-6 flex items-center gap-2">
              <Search size={14} /> Cibler un profil athlète
            </h2>
            
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Fingerprint className="absolute left-4 top-4 w-4 h-4 text-zinc-700" />
                <input 
                  type="text"
                  placeholder="NOM, PSEUDO OU EMAIL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black border border-zinc-900 rounded-xl py-4 pl-12 pr-4 text-xs font-bold uppercase outline-none focus:border-red-600 transition-all"
                />
              </div>
              <button 
                type="submit" 
                disabled={isSearching}
                className="bg-white text-black px-10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 h-[52px]"
              >
                {isSearching ? <RefreshCcw size={14} className="animate-spin" /> : "Identifier"}
              </button>
            </form>
          </section>

          {/* MODULE DE TRANSFERT (SI IDENTIFIÉ) */}
          {foundAthlete && (
            <section className="bg-zinc-950 border border-red-600/20 rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-start justify-between mb-8 border-b border-zinc-900 pb-6">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter text-white">Protocole de Transfert</h2>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Remplacement de l&apos;identifiant de connexion</p>
                </div>
                <div className="bg-red-600/10 border border-red-600/20 px-3 py-1 rounded-full">
                   <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Accès Niveau 1</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* État Civil Actuel */}
                <div className="space-y-4">
                  <div className="p-5 bg-black border border-zinc-900 rounded-2xl">
                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-3">Identité Actuelle</label>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-600 shadow-inner">
                        <User size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-black uppercase truncate">{foundAthlete.pseudo || "SANS PSEUDO"}</p>
                        <p className="text-[9px] font-mono text-zinc-500 truncate">{foundAthlete.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration Nouveau Mail */}
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-4 w-4 h-4 text-red-600" />
                    <input 
                      type="email"
                      placeholder="NOUVEL EMAIL CIBLE..."
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-xs font-bold uppercase outline-none focus:border-red-600 transition-all text-white"
                    />
                  </div>
                  
                  <button 
                    onClick={handleIdentityTransfer}
                    disabled={isUpdating || !newEmail}
                    className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                  >
                    {isUpdating ? <RefreshCcw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                    Forcer le Changement
                  </button>
                </div>
              </div>

              {/* Alerte Sécurité */}
              <div className="mt-8 p-4 bg-red-950/20 border border-red-600/20 rounded-xl flex items-start gap-4">
                <AlertTriangle className="text-red-600 shrink-0" size={18} />
                <div className="space-y-1">
                  <p className="text-[10px] text-white font-black uppercase tracking-widest">Avertissement de sécurité</p>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold leading-relaxed">
                    Cette action est irréversible sans une nouvelle intervention. Le joueur perdra l&apos;accès avec son ancien email dès validation.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Zone de notifications */}
          {status && (
            <div className={`p-5 rounded-2xl border flex items-center gap-4 animate-in zoom-in-95 ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              <p className="text-[10px] font-black uppercase tracking-[0.15em]">{status.message}</p>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
