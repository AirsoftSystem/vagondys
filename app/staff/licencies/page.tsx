"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createStaffClient, type Athlete } from "@/lib/supabase/client"; 
import { 
  Users, ChevronLeft, RefreshCcw, Mail, Trash2, 
  ChevronRight, FileText, Shield, ChevronDown, UserPlus, 
  Send, Download, CheckCircle, Search, MapPin, Globe, Trophy, Calendar, Hash
} from "lucide-react";
import Link from "next/link";

// IMPORT DE L'ACTION RÉELLE
import { sendInvitation } from "@/app/(public)/contact/actions";

type DocCategory = "PI" | "JUSTIFICATIF_DOMICILE" | "CHARTE" | "INSCRIPTION_TOURNOI" | "GAIN" | "AUTRE";

// Interface étendue pour inclure les données de signalement et l'état d'alerte + DATA RICHES
interface NewAthleteEntry extends Athlete {
  signal_id?: string;
  has_unread_signal?: boolean;
  // Champs supplémentaires extraits du payload GitHub
  city?: string;
  country?: string;
  message?: string;
  dossier_ref?: string; 
}

// Interface pour typer les données provenant de l'API GitHub (évite le "any")
interface GitHubAthleteItem {
  dossier: {
    id: string;
    created_at: string;
    dossier_ref: string;
    payload: {
      name: string;
      pseudo?: string;
      email: string;
      phone?: string;
      city?: string;
      country?: string;
      message?: string;
      client_identity?: {
        documents_urls?: string[];
      };
    };
  };
}

export default function StaffLicenciesPage() {
  const supabaseStaff = createStaffClient();

  const [athletes, setAthletes] = useState<NewAthleteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentEmail, setAgentEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Par défaut, on affiche la liste
  const [view, setView] = useState<'none' | 'form' | 'list'>('list');
  
  const [newEmail, setNewEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [selectedAthlete, setSelectedAthlete] = useState<NewAthleteEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocCategory>("PI");

  /**
   * STRATÉGIE DE CHARGEMENT : 
   * On récupère les données via l'API GitHub en filtrant par la ville de l'agent.
   */
  const fetchAllAthletes = useCallback(async (email: string) => {
    setLoading(true);
    try {
      // Détermination de la ville selon l'email de l'agent (Logique secteur)
      let city = "";
      if (email.includes("nantes")) city = "Nantes";
      else if (email.includes("paris")) city = "Paris";
      else if (email.includes("lyon")) city = "Lyon";
      else if (email.includes("marseille")) city = "Marseille";
      else if (email.includes("bordeaux")) city = "Bordeaux";
      else if (email.includes("lille")) city = "Lille";
      else if (email.includes("toulouse")) city = "Toulouse";

      // Appel à la nouvelle route API avec le filtre City
      const response = await fetch(`/api/archive-external?city=${city}`);
      if (!response.ok) throw new Error("Erreur GitHub");
      
      const githubData: GitHubAthleteItem[] = await response.json();

      // Transformation des données GitHub (mapped) en format Athlete pour le front
      const formattedAthletes: NewAthleteEntry[] = githubData.map((item) => ({
        id: item.dossier.id,
        created_at: item.dossier.created_at,
        full_name: item.dossier.payload.name,
        pseudo: item.dossier.payload.pseudo || "",
        email: item.dossier.payload.email,
        phone: item.dossier.payload.phone || "",
        city: item.dossier.payload.city || "NON RENSEIGNÉ",
        country: item.dossier.payload.country || "FRANCE",
        message: item.dossier.payload.message,
        dossier_ref: item.dossier.dossier_ref,
        rank: "RECRUE", // Valeur par défaut
        status: "ACTIF", 
        documents_urls: item.dossier.payload.client_identity?.documents_urls || [],
        has_unread_signal: false 
      }));

      setAthletes(formattedAthletes);

    } catch (err) {
      console.error("Erreur chargement base athlètes via GitHub:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAgentSession = async () => {
      const { data: { user } } = await supabaseStaff.auth.getUser();
      if (user?.email) {
        const email = user.email.toLowerCase();
        setAgentEmail(email);
        fetchAllAthletes(email);
      }
    };
    checkAgentSession();
  }, [supabaseStaff, fetchAllAthletes]);

  // FILTRAGE ULTRA-RÉACTIF (Email, Pseudo ou Nom Complet)
  const filteredAthletes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return athletes;
    return athletes.filter(a => 
      (a.pseudo?.toLowerCase().includes(query)) || 
      (a.email?.toLowerCase().includes(query)) ||
      (a.full_name?.toLowerCase().includes(query))
    );
  }, [athletes, searchQuery]);

  // SELECTION ET GESTION DE LA LECTURE
  const handleSelectAthlete = async (athlete: NewAthleteEntry) => {
    setSelectedAthlete(athlete);

    if (athlete.signal_id) {
      try {
        await supabaseStaff
          .from('pending_signals')
          .update({ is_read: true })
          .eq('id', athlete.signal_id);
        
        setAthletes(prev => prev.map(a => 
          a.id === athlete.id ? { ...a, has_unread_signal: false, signal_id: undefined } : a
        ));
      } catch (err) {
        console.error("Erreur marquage lecture:", err);
      }
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    setIsSending(true);
    try {
      const result = await sendInvitation(newEmail.trim());
      if (result.success) {
        alert(`SUCCÈS : Le lien du formulaire d'inscription a été envoyé à ${newEmail.toUpperCase()}.`);
        setNewEmail("");
        setView('list');
      } else {
        throw new Error(result.error || "Échec de l'envoi");
      }
    } catch (err) {
      alert(`ERREUR SYSTÈME : ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 p-4 font-sans text-white">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/staff" title="Retour au Dashboard" className="text-zinc-500 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-black uppercase italic tracking-[0.2em] text-white">
              Unité <span className="text-red-600">Licenciés</span>
            </h1>
          </div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono">
            Agent Connecté : {agentEmail || "Vérification..."}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            type="button"
            title="Envoyer le formulaire d'inscription"
            onClick={() => setView(view === 'form' ? 'list' : 'form')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${view === 'form' ? 'bg-red-600 border-red-600 text-white' : 'bg-transparent border-zinc-800 text-zinc-400 hover:border-red-600'}`}
          >
            <Send className="w-3.5 h-3.5" /> Envoi Formulaire
          </button>
        </div>
      </header>

      <div className="min-h-[60vh]">
        {view === 'form' && (
          <div className="max-w-2xl mx-auto bg-neutral-950 border border-neutral-900 rounded-3xl p-10 animate-in fade-in zoom-in-95 duration-300">
             <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-white mb-10 flex items-center gap-4">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
               Déploiement Nouveau Dossier
            </h2>
            
            <form onSubmit={handleSendInvitation} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Email du futur Joueur</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 w-4 h-4 text-zinc-700" />
                  <input 
                    id="email" 
                    type="email" 
                    required 
                    value={newEmail} 
                    title="Adresse email du destinataire" 
                    placeholder="email@joueur.com" 
                    onChange={(e) => setNewEmail(e.target.value)} 
                    className="w-full bg-black border border-neutral-800 rounded-xl p-4 pl-12 text-xs text-white focus:border-red-600 outline-none transition-all font-mono" 
                  />
                </div>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-900 p-6 rounded-2xl space-y-3">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Contenu de l&apos;envoi :</p>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-[10px] text-zinc-400 leading-relaxed uppercase font-bold">Lien sécurisé vers le formulaire d&apos;inscription Vagondys</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-[10px] text-zinc-400 leading-relaxed uppercase font-bold">Instructions pour l&apos;envoi de la Pièce d&apos;Identité</p>
                </div>
              </div>

              <button type="submit" disabled={isSending} className="w-full bg-red-600 hover:bg-white hover:text-black text-white font-black py-5 rounded-xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                {isSending ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {isSending ? "ENVOI EN COURS..." : "ENVOYER L'INVITATION PAR EMAIL"}
              </button>
            </form>
          </div>
        )}

        {view === 'list' && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 space-y-3">
              {/* BARRE DE RECHERCHE GLOBALE */}
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input 
                  type="text"
                  placeholder="RECHERCHER PAR EMAIL OU PSEUDO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-2xl p-4 pl-12 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Base Athlètes ({filteredAthletes.length})
                </h3>
                <button type="button" title="Actualiser la liste" onClick={() => agentEmail && fetchAllAthletes(agentEmail)} className="text-zinc-600 hover:text-red-600 transition-colors">
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[65vh] pr-2 custom-scrollbar">
                {filteredAthletes.length > 0 ? (
                  filteredAthletes.map((athlete) => (
                    <button 
                      key={athlete.id} 
                      type="button"
                      title={`Voir la fiche de ${athlete.pseudo || athlete.full_name}`}
                      onClick={() => handleSelectAthlete(athlete)}
                      className={`w-full group border p-4 rounded-xl flex items-center justify-between transition-all duration-200 ${selectedAthlete?.id === athlete.id ? 'bg-red-600 border-red-600' : 'bg-neutral-950 border-neutral-900 hover:border-zinc-700'}`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic text-[10px] ${selectedAthlete?.id === athlete.id ? 'bg-white text-red-600' : 'bg-neutral-900 text-zinc-500'}`}>
                            {athlete.pseudo ? athlete.pseudo[0].toUpperCase() : athlete.full_name ? athlete.full_name[0].toUpperCase() : "?"}
                          </div>
                          {athlete.has_unread_signal && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-black rounded-full animate-ping shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                          )}
                        </div>
                        <div>
                          <p className={`text-xs font-black uppercase tracking-widest ${selectedAthlete?.id === athlete.id ? 'text-white' : 'text-zinc-200'}`}>
                            {athlete.pseudo || athlete.full_name}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className={`text-[8px] font-bold uppercase tracking-tighter ${selectedAthlete?.id === athlete.id ? 'text-red-100' : 'text-zinc-600'}`}>
                              {athlete.email}
                            </p>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className={selectedAthlete?.id === athlete.id ? 'text-white' : 'text-zinc-800'} />
                    </button>
                  ))
                ) : (
                   <div className="py-10 text-center border border-dashed border-neutral-900 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase text-zinc-700 tracking-widest">Aucun résultat trouvé</p>
                   </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8">
              {selectedAthlete ? (
                <div className="space-y-6 sticky top-8 animate-in slide-in-from-right-4 duration-300">
                  
                  {/* CARTE D'IDENTITÉ ATHLÈTE 100% COMPLÈTE */}
                  <div className="bg-neutral-950 border border-neutral-900 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-neutral-900 bg-linear-to-r from-neutral-900/50 to-transparent flex justify-between items-start">
                      <div className="flex gap-6">
                        <div className="w-24 h-24 bg-neutral-900 rounded-3xl border border-neutral-800 flex items-center justify-center text-3xl font-black italic text-red-600 shadow-inner">
                          {selectedAthlete.pseudo ? selectedAthlete.pseudo[0].toUpperCase() : "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Athlète Officiel</span>
                            <span className="text-zinc-600 text-[9px] font-mono uppercase tracking-tighter flex items-center gap-1">
                              <Hash className="w-3 h-3" /> {selectedAthlete.dossier_ref}
                            </span>
                          </div>
                          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">
                            {selectedAthlete.full_name}
                          </h2>
                          <p className="text-red-600 text-[11px] font-black uppercase tracking-[0.4em] mt-2">
                            {selectedAthlete.pseudo || "SANS ALIAS"}
                          </p>
                        </div>
                      </div>
                      <button type="button" title="Supprimer ce dossier" className="p-4 bg-red-600/5 text-red-600/40 rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-red-600/10 hover:border-red-600">
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="p-8 grid md:grid-cols-3 gap-8">
                      {/* COLONNE 1 : IDENTITÉ & LOCALISATION */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                           <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] border-l-2 border-red-600 pl-3">Localisation</h4>
                           <div className="space-y-3">
                             <div className="flex items-center gap-3 text-zinc-300">
                               <MapPin className="w-4 h-4 text-red-600" />
                               <span className="text-[11px] font-bold uppercase tracking-widest">{selectedAthlete.city}</span>
                             </div>
                             <div className="flex items-center gap-3 text-zinc-300">
                               <Globe className="w-4 h-4 text-red-600" />
                               <span className="text-[11px] font-bold uppercase tracking-widest">{selectedAthlete.country}</span>
                             </div>
                           </div>
                        </div>

                        <div className="space-y-4 pt-4">
                           <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] border-l-2 border-zinc-800 pl-3">Contact Direct</h4>
                           <div className="space-y-3">
                             <div className="flex items-center gap-3 text-zinc-300">
                               <Mail className="w-4 h-4 text-zinc-600" />
                               <span className="text-[10px] font-mono">{selectedAthlete.email}</span>
                             </div>
                             <div className="flex items-center gap-3 text-zinc-300">
                               <Send className="w-4 h-4 text-zinc-600" />
                               <span className="text-[10px] font-mono">{selectedAthlete.phone || "NON RÉPERTORIÉ"}</span>
                             </div>
                           </div>
                        </div>
                      </div>

                      {/* COLONNE 2 : STATUS & PERF */}
                      <div className="space-y-6 bg-neutral-900/30 p-6 rounded-3xl border border-neutral-900">
                        <div className="space-y-4 text-center">
                           <h4 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Grade Actuel</h4>
                           <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 rounded-xl">
                              <Trophy className="w-4 h-4 text-white" />
                              <span className="text-xs font-black uppercase text-white tracking-widest">{selectedAthlete.rank}</span>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                           <div className="text-center p-3 border border-neutral-800 rounded-2xl">
                              <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Niveau</p>
                              <p className="text-lg font-black text-white italic">01</p>
                           </div>
                           <div className="text-center p-3 border border-neutral-800 rounded-2xl">
                              <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Status</p>
                              <p className="text-[10px] font-black text-green-500 uppercase">{selectedAthlete.status}</p>
                           </div>
                        </div>

                        <div className="pt-2 text-center">
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-2">
                            <Calendar className="w-3 h-3" /> Enrôlé le {new Date(selectedAthlete.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>

                      {/* COLONNE 3 : COFFRE-FORT */}
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2 border-b border-neutral-900 pb-3">
                          <Shield size={14} className="text-red-600" /> Documents
                        </h3>
                        
                        <div className="relative">
                          <select 
                            title="Catégorie documentaire"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as DocCategory)}
                            className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer focus:border-red-600 text-white"
                          >
                            <option value="PI">PIÈCE D&apos;ID</option>
                            <option value="JUSTIFICATIF_DOMICILE">DOMICILE</option>
                            <option value="CHARTE">CHARTE</option>
                            <option value="INSCRIPTION_TOURNOI">TOURNOIS</option>
                            <option value="GAIN">GAINS</option>
                            <option value="AUTRE">AUTRES</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-3.5 w-3 h-3 text-zinc-500 pointer-events-none" />
                        </div>

                        <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                          {selectedAthlete.documents_urls && selectedAthlete.documents_urls.length > 0 ? (
                            selectedAthlete.documents_urls.map((url, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-black border border-neutral-900 rounded-xl hover:border-zinc-700 transition-all">
                                <FileText className="w-3 h-3 text-red-600" />
                                <span className="text-[8px] font-black uppercase truncate flex-1 px-2 text-white">{url.split('/').pop()}</span>
                                <a 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  title="Télécharger le document" 
                                  className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                                >
                                  <Download size={12} />
                                </a>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 border border-dashed border-neutral-900 rounded-2xl opacity-40">
                              <p className="text-[8px] font-black uppercase text-zinc-600">Aucun fichier</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION MESSAGE / BIOGRAPHIE SI DISPONIBLE */}
                  {selectedAthlete.message && (
                    <div className="bg-neutral-950 border border-neutral-900 rounded-[2rem] p-8">
                       <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Note d&apos;enrôlement</h4>
                       <p className="text-[11px] font-mono text-zinc-400 leading-relaxed uppercase italic">
                         &quot;{selectedAthlete.message}&quot;
                       </p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="h-full min-h-[500px] border-2 border-dashed border-neutral-900 rounded-[3rem] flex flex-col items-center justify-center text-zinc-800">
                  <div className="p-8 bg-neutral-900/10 rounded-full mb-6">
                    <UserPlus size={60} className="opacity-20" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">Sélectionner un athlète pour décrypter le dossier</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
