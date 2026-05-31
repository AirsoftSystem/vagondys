
"use client";

import React, { useState, Suspense } from 'react';
import { 
  User, 
  Lock, 
  ChevronRight, 
  ArrowLeft, 
  Home, 
  AlertCircle, 
  RefreshCcw,
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createVagondysClient } from "@/lib/supabase/client";

/**
 * COMPOSANT FORMULAIRE (Isolé pour le Suspense)
 * Gère la logique d'authentification et les messages de statut d'URL.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Message de confirmation après activation par email
  const isConfirmed = searchParams.get('status') === 'confirmed';
  
  /** * SÉCURITÉ : Utilisation du client Vagondys standard.
   * Par défaut, createVagondysClient utilise les clés MASTER si aucun paramètre n'est passé,
   * ce qui est exactement ce qu'il nous faut pour l'authentification centrale.
   */
  const supabase = createVagondysClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string || "").toLowerCase().trim();
    const password = (formData.get('password') as string || "").trim();

    // VALIDATION CLIENT-SIDE : Format de mot de passe requis
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    
    if (!passwordRegex.test(password)) {
      setError("SÉCURITÉ INSUFFISANTE : FORMAT NON VALIDE.");
      setLoading(false);
      return;
    }

    // AUTHENTIFICATION : Pilotée par le projet MASTER (Le Cerveau)
    const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError) {
      console.error("Auth Failure:", authError.message);
      setError("ÉCHEC D'IDENTIFICATION : ACCÈS REFUSÉ.");
      setLoading(false);
      return;
    }

    // ✅ Après authentification réussie, vérifier le type de compte
    const userId = authData.user?.id;
    let redirectUrl = "/espace-joueur"; // Par défaut pour les joueurs

    if (userId) {
      try {
        // Vérifier si l'utilisateur est un compte messagerie
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
          
          const { data: messagerieAccount } = await supabaseAdmin
            .from("messagerie_accounts")
            .select("role, status")
            .eq("user_id", userId)
            .maybeSingle();
          
          if (messagerieAccount && messagerieAccount.status === "active") {
            // C'est un compte messagerie → rediriger vers la messagerie
            redirectUrl = "/messagerie";
            console.log(`✅ Connexion messagerie: ${email} → redirection vers /messagerie`);
          } else {
            console.log(`✅ Connexion joueur: ${email} → redirection vers /espace-joueur`);
          }
        }
      } catch (err) {
        console.error("Erreur vérification type compte:", err);
        // En cas d'erreur, on reste sur la redirection par défaut (espace-joueur)
      }
    }

    /**
     * REDIRECTION : Vers l'espace approprié (joueur ou messagerie)
     * router.refresh() est vital ici pour forcer le middleware (proxy.ts)
     * à re-analyser les cookies de session.
     */
    router.refresh();
    router.push(redirectUrl);
  };

  return (
    <form onSubmit={handleLogin} className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl space-y-4 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/5 blur-[100px] pointer-events-none" />

      {/* MESSAGE DE SUCCÈS (ACTIVATION COMPTE) */}
      {isConfirmed && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-green-500 text-[10px] font-black uppercase tracking-widest mb-4">
          <CheckCircle2 className="w-4 h-4" /> VOTRE COMPTE A ÉTÉ ACTIVÉ. IDENTIFIEZ-VOUS.
        </div>
      )}

      {/* MESSAGE D'ERREUR */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-500 text-[10px] font-black uppercase tracking-widest mb-4 animate-pulse">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* CHAMP IDENTIFIANT */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 block h-3">
          Identifiant Unique
        </label>
        <div className="relative h-12">
          <div className="absolute left-3 top-3.5 w-4 h-4 flex items-center justify-center">
            <User className="w-full h-full text-zinc-700" />
          </div>
          <input 
            id="email"
            name="email"
            type="email" 
            placeholder="EMAIL" 
            required
            className="w-full h-full bg-black border border-zinc-800 rounded-lg py-3.5 pl-10 pr-4 text-sm outline-none focus:border-red-600 text-white font-mono transition-colors" 
          />
        </div>
      </div>

      {/* CHAMP MOT DE PASSE */}
      <div className="space-y-2">
        <label htmlFor="password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 block h-3">
          Clef d&apos;Accès
        </label>
        <div className="relative h-12">
          <div className="absolute left-3 top-3.5 w-4 h-4 flex items-center justify-center">
            <Lock className="w-full h-full text-zinc-700" />
          </div>
          <input 
            id="password"
            name="password"
            type={showPassword ? "text" : "password"} 
            placeholder="••••••••" 
            required
            className="w-full h-full bg-black border border-zinc-800 rounded-lg py-3.5 pl-10 pr-12 text-sm outline-none focus:border-red-600 text-white transition-colors" 
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ACTIONS COMPTE */}
      <div className="pt-2 space-y-3">
        <button 
          type="submit" 
          disabled={loading}
          className={`w-full h-14 bg-red-600 hover:bg-white hover:text-black text-white font-black py-4 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <>Entrer dans l&apos;Arène <ChevronRight className="w-4 h-4" /></>
          )}
        </button>

        <Link 
          href="/inscription"
          className="w-full h-14 bg-black border border-zinc-800 hover:border-white text-zinc-400 hover:text-white font-black py-4 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <UserPlus className="w-4 h-4" /> Inscription
        </Link>
      </div>
    </form>
  );
}

/**
 * PAGE PRINCIPALE (Structure Vagondys)
 */
export default function AthleteLogin() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="grow flex flex-col items-center justify-center p-12 relative z-10">
        {/* NAVIGATION HAUTE */}
        <nav className="absolute top-8 left-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 h-auto sm:h-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group h-4">
            <Home className="w-4 h-4 text-red-600" /> VAGONDYS
          </Link>
          <div className="hidden sm:block w-px h-4 bg-zinc-900" />
          <Link href="/joueurs" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group h-4">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            Retour Bibliothèque
          </Link>
        </nav>

        <div className="w-full max-w-md space-y-8 mt-16 mb-16">
          <header className="text-center min-h-[80px]">
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
              Accès Athlète
            </h1>
            <p className="text-zinc-500 text-[10px] tracking-[0.3em] uppercase mt-2 h-3">
              Saison 2026 — Vagondys Core
            </p>
          </header>

          {/* SUSPENSE BOUNDARY : Correction de l'erreur bloquante Vercel */}
          <Suspense fallback={
            <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl flex flex-col items-center justify-center h-64 space-y-4">
              <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
              <p className="text-[8px] text-zinc-600 uppercase tracking-widest animate-pulse">Initialisation du protocole...</p>
            </div>
          }>
            <LoginForm />
          </Suspense>
          
          {/* FOOTER DE PAGE */}
          <div className="space-y-6">
            <p className="text-center text-[9px] text-zinc-700 uppercase tracking-widest font-bold h-3">
              Mot de passe oublié ? Contactez votre <Link href="/contact" className="text-zinc-500 hover:text-red-600 underline decoration-red-600/30 transition-all">Administrateur</Link>
            </p>

            <div className="flex flex-col items-center gap-6 pt-8 opacity-30">
              <div className="w-8 h-px bg-zinc-800" />
              <p className="text-[8px] text-zinc-500 uppercase tracking-[0.5em] text-center font-bold">
                Vagondys Security Protocol v.16.1.1
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
