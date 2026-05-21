
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { 
  RefreshCcw,
  Lock,
  Unlock,
  ShieldCheck,
  ArrowLeft,
  AlertTriangle,
  Home
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createVagondysClient, type Athlete, fetchGitHubArchive } from "@/lib/supabase/client";

// Import des nouveaux sous-composants
import ProfileForm from "./ProfileForm";
import DocumentVault from "./DocumentVault";

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
    confirmed: boolean;
  };
  files: GitHubFile[];
}

/**
 * Interface étendue pour l'athlète
 */
interface ExtendedAthlete extends Omit<Athlete, 'pseudo' | 'phone'> {
  country?: string;
  city?: string;
  dossier_ref?: string;
  documents_urls?: string[];
  pseudo?: string;
  phone?: string;
}

type DocCategory = "PI" | "JUSTIFICATIF_DOMICILE" | "CHARTE" | "INSCRIPTION_TOURNOI" | "GAIN" | "AUTRE";

export default function CarteIDPage() {
  const router = useRouter();
  
  // ✅ CORRECTION : Stocker le client de données séparément
  const [supabaseData, setSupabaseData] = useState<ReturnType<typeof createVagondysClient> | null>(null);
  
  // Client par défaut pour l'AUTH (Master)
  const supabaseAuth = createVagondysClient(); 
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [player, setPlayer] = useState<ExtendedAthlete | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [newPseudo, setNewPseudo] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<DocCategory>("PI");
  const [isUploading, setIsUploading] = useState(false);
  const [githubDocs, setGithubDocs] = useState<GitHubArchiveResponse | null>(null);

  /**
   * RÉCUPÉRATION DES DONNÉES (LOGIQUE DYNAMIQUE CITY-AWARE)
   */
  const fetchPlayerData = useCallback(async () => {
    try {
      // 1. On récupère la session sur le Master
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      
      if (userError || !user) {
        console.log("Utilisateur non connecté, redirection...");
        router.push("/connexion");
        return;
      }

      // 2. Identification de la ville cible
      const userCity = user.user_metadata?.city || "NANTES";
      
      // 3. ✅ CORRECTION : Créer le client de données AVEC la ville
      const dataClient = createVagondysClient(userCity);
      setSupabaseData(dataClient);

      let athleteData: ExtendedAthlete | null = null;

      // 4. Lecture des données dans la base de la VILLE
      try {
        const { data, error } = await dataClient
          .from('athletes')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error("Erreur DB Ville:", error);
          setAuthError(`Erreur base ${userCity}: ${error.message}`);
        }
        
        if (data) {
          athleteData = {
            ...data,
            pseudo: data.pseudo ?? undefined,
            phone: data.phone ?? undefined,
            country: data.country ?? undefined,
            city: userCity, 
            dossier_ref: data.dossier_ref ?? undefined,
            documents_urls: data.documents_urls ?? undefined
          };
        }
      } catch (err) {
        console.error("Exception DB Ville:", err);
        setAuthError(`Impossible de contacter la base ${userCity}`);
      }

      // 5. FALLBACK : Si la table athletes de la ville n'est pas accessible, on lit depuis le MASTER
      if (!athleteData) {
        console.log("Fallback vers MASTER pour récupérer les infos du joueur");
        const { data: masterData, error: masterError } = await supabaseAuth
          .from('athletes_registry')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (masterError) {
          console.error("Erreur lecture MASTER:", masterError);
        }

        if (masterData) {
          athleteData = {
            id: user.id,
            email: user.email || "",
            full_name: masterData.full_name || user.user_metadata?.full_name || "Athlète",
            pseudo: masterData.pseudo || user.user_metadata?.pseudo || "",
            phone: masterData.phone || "",
            city: masterData.city || userCity,
            country: masterData.country || "FR",
            dossier_ref: masterData.dossier_ref,
            status: masterData.status || "ACTIF",
            rank: "RECRUE",
            points: 0,
            created_at: masterData.created_at || new Date().toISOString()
          } as ExtendedAthlete;
        }
      }

      if (athleteData) {
        setPlayer(athleteData);
        setNewPseudo(athleteData.pseudo || "");
        setNewPhone(athleteData.phone || "");

        // Récupération des archives GitHub (Spécifique Ville)
        if (athleteData.dossier_ref) {
          try {
            const archive = await fetchGitHubArchive(athleteData.dossier_ref);
            if (archive) {
              setGithubDocs(archive as unknown as GitHubArchiveResponse);
            }
          } catch (archiveErr) {
            console.error("Erreur chargement archive GitHub:", archiveErr);
          }
        }
      } else {
        // Cas critique : Aucune donnée trouvée nulle part
        setPlayer({
            id: user.id,
            email: user.email || "",
            full_name: user.user_metadata?.full_name || "Athlète",
            city: userCity,
            rank: "RECRUE",
            status: "EN_ATTENTE",
            created_at: new Date().toISOString()
        } as ExtendedAthlete);
        setAuthError("Profil non trouvé. Contactez le STAFF.");
      }
    } catch (err) {
      console.error("CRITICAL_ROUTING_ERROR:", err);
      setAuthError("Erreur critique de routage station.");
    } finally {
      setLoading(false);
    }
  }, [supabaseAuth, router]);

  useEffect(() => {
    fetchPlayerData();
  }, [fetchPlayerData]);

  /**
   * MISE À JOUR DU PROFIL
   */
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setUpdateMessage(null);

    try {
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) throw new Error("SESSION EXPIREE");

      // Mise à jour Auth (Master) pour le mot de passe
      if (newPassword) {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
          throw new Error("SÉCURITÉ : 8 CARACTÈRES (MAJ, MIN, CHIFFRE, SYMBOLE) REQUIS.");
        }
        const { error: updateAuthErr } = await supabaseAuth.auth.updateUser({ password: newPassword });
        if (updateAuthErr) throw updateAuthErr;
      }

      const userCity = user.user_metadata?.city || "NANTES";
      
      // ✅ CORRECTION : Utiliser le client de données stocké ou en créer un nouveau
      const dataClient = supabaseData || createVagondysClient(userCity);
      
      // Essayer de mettre à jour dans la base de la ville
      try {
        const { error: dbError } = await dataClient
          .from('athletes')
          .update({ 
            pseudo: newPseudo.trim(),
            phone: newPhone.trim()
          })
          .eq('id', user.id);

        if (dbError) {
          console.warn("Erreur mise à jour ville, fallback MASTER:", dbError);
          // Fallback : mettre à jour dans le MASTER
          const { error: masterUpdateError } = await supabaseAuth
            .from('athletes_registry')
            .update({ 
              pseudo: newPseudo.trim(),
              phone: newPhone.trim()
            })
            .eq('user_id', user.id);
          
          if (masterUpdateError) throw masterUpdateError;
        }
      } catch (dbErr) {
        console.error("Erreur mise à jour base:", dbErr);
      }

      // Synchronisation archive GitHub Ville
      if (player?.dossier_ref) {
        await fetch('/api/archive-external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city_code: userCity,
            message: {
              dossier_ref: player.dossier_ref,
              payload: {
                name: player.full_name,
                pseudo: newPseudo.trim(),
                email: player.email,
                phone: newPhone.trim(),
                city: userCity
              }
            }
          })
        }).catch(console.error);
      }

      setUpdateMessage({ type: 'success', text: "CARTE ID MISE À JOUR." });
      setNewPassword(""); 
      setIsEditMode(false);
      fetchPlayerData(); 
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ERREUR LORS DE LA MISE À JOUR.";
      setUpdateMessage({ type: 'error', text: msg.toUpperCase() });
    } finally {
      setUpdating(false);
    }
  };

  /**
   * GESTION DOCUMENTAIRE (Coffre-Fort GitHub de Ville)
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !player) return;
    
    setIsUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${player.id}/${selectedCategory}_${Date.now()}.${fileExt}`;

    try {
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) throw new Error("Session expirée");

      const userCity = user.user_metadata?.city || "NANTES";
      
      // ✅ CORRECTION : Utiliser le client de données stocké ou en créer un nouveau
      const dataClient = supabaseData || createVagondysClient(userCity);

      // 1. Upload dans le bucket de la ville
      const { error: uploadError } = await dataClient.storage
        .from('joueurs-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = dataClient.storage
        .from('joueurs-documents')
        .getPublicUrl(fileName);

      // 2. Update DB Ville
      const currentDocs = player.documents_urls || [];
      const { error: dbError } = await dataClient
        .from('athletes')
        .update({ documents_urls: [...currentDocs, publicUrl] })
        .eq('id', player.id);

      if (dbError) {
        console.warn("Erreur mise à jour documents:", dbError);
      }
      
      // 3. ARCHIVAGE GITHUB VILLE (Via Engine)
      await fetch('/api/archive-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_code: userCity,
          message: {
            dossier_ref: player.dossier_ref,
            payload: {
              name: player.full_name,
              email: player.email,
              city: userCity,
              last_upload: fileName
            }
          },
          history: [{
            agent_email: "SYSTEM",
            content: `Document [${selectedCategory}] ajouté : ${fileName}`,
            document_url: publicUrl,
            created_at: new Date().toISOString()
          }]
        })
      }).catch(console.error);

      fetchPlayerData();
      alert("DOCUMENT TRANSMIS ET ARCHIVÉ DANS VOTRE UNITÉ LOCALE.");
    } catch (err) {
      console.error(err);
      alert("ERREUR LORS DE L'ENVOI OU DE L'ARCHIVAGE.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
        <h1 className="text-2xl font-black uppercase tracking-tighter">Erreur de Station</h1>
        <p className="text-xs text-zinc-500 uppercase tracking-widest max-w-md leading-relaxed">
          Impossible de contacter votre Unité Locale. <br/>
          {authError && <span className="text-red-500 mt-2 block">{authError}</span>}
          Vérifiez votre connexion ou contactez le support de votre ville.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.reload()} 
            className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200"
          >
            Réessayer
          </button>
          <Link 
            href="/espace-joueur"
            className="bg-zinc-900 text-white border border-zinc-800 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:border-red-600 flex items-center gap-2"
          >
            <Home size={14} /> Retour Accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-neutral-100 px-6 py-24 font-sans relative">
      <div className="max-w-4xl mx-auto relative z-10">
        <Link 
          href="/espace-joueur" 
          title="Retourner à l'espace joueur"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors text-[10px] font-black uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> Retour à l&apos;espace joueur
        </Link>

        {authError && (
          <div className="mb-4 p-4 bg-red-600/20 border border-red-600 rounded-xl text-red-600 text-[10px] font-bold uppercase tracking-widest">
            ⚠️ {authError}
          </div>
        )}

        <div className="bg-zinc-950 border border-red-600/30 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.1)]">
          <div className="p-8 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-full border-2 border-red-600 bg-red-600/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">Vagondys ID Officielle</h1>
                <p className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] mt-2 uppercase">
                  Identification Réseau | Unité : {player.city?.toUpperCase() || "NANTES"}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              title={isEditMode ? "Désactiver le mode édition" : "Modifier mes informations"}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isEditMode ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
            >
              {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
              {isEditMode ? "Mode Édition Actif" : "Modifier mes infos"}
            </button>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ProfileForm 
                player={player}
                isEditMode={isEditMode}
                setIsEditMode={setIsEditMode}
                newPseudo={newPseudo}
                setNewPseudo={setNewPseudo}
                newPhone={newPhone}
                setNewPhone={setNewPhone}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                handleUpdateProfile={handleUpdateProfile}
                updating={updating}
                updateMessage={updateMessage}
              />

              <DocumentVault 
                player={player}
                githubDocs={githubDocs}
                selectedCategory={selectedCategory}
                setSelectedCategory={(val) => setSelectedCategory(val as DocCategory)}
                isUploading={isUploading}
                handleFileUpload={handleFileUpload}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
