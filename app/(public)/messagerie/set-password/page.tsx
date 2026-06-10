
"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Home, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2,
  AlertTriangle,
  RefreshCcw
} from "lucide-react";

/**
 * Composant interne pour utiliser useSearchParams
 */
function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validatePassword = (pwd: string): boolean => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    return regex.test(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token || !email) {
      setError("Lien invalide. Veuillez refaire une demande.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Veuillez saisir un mot de passe.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (!validatePassword(password)) {
      setError("SÉCURITÉ INSUFFISANTE : 8 CARACTÈRES (MAJ, MIN, CHIFFRE, SYMBOLE) REQUIS.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/messagerie/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: email.toLowerCase(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la définition du mot de passe");
      }

      setSuccess(true);
      
      // ✅ Envoi du message de bienvenue après définition du mot de passe
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseClient = createClient(supabaseUrl, supabaseKey);
          
          // Récupérer le compte messagerie pour obtenir dossier_ref
          const { data: account } = await supabaseClient
            .from("messagerie_accounts")
            .select("dossier_ref")
            .eq("email", email.toLowerCase())
            .maybeSingle();
          
          if (account?.dossier_ref) {
            console.log(`📤 Envoi du message de bienvenue pour ${account.dossier_ref}`);
            
            // Envoyer le message de bienvenue via l'API messages
            const welcomeResponse = await fetch("/api/messagerie/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dossierRef: account.dossier_ref,
                content: "Bienvenue sur la messagerie privée VAGONDYS. Notre équipe prendra contact avec vous sous 48h.",
              }),
            });
            
            if (!welcomeResponse.ok) {
              const errorData = await welcomeResponse.json();
              console.error("❌ Erreur API message de bienvenue:", {
                status: welcomeResponse.status,
                error: errorData.error || "Erreur inconnue"
              });
              alert(`Erreur lors de l'envoi du message de bienvenue: ${welcomeResponse.status} - ${errorData.error || "Erreur inconnue"}`);
            } else {
              console.log(`✅ Message de bienvenue envoyé avec succès pour ${email}`);
            }
          } else {
            console.warn(`⚠️ Aucun dossier_ref trouvé pour ${email}, message de bienvenue non envoyé`);
          }
        }
      } catch (welcomeErr) {
        console.error("❌ Exception lors de l'envoi du message de bienvenue:", welcomeErr);
        alert(`Erreur technique lors de l'envoi du message de bienvenue: ${welcomeErr instanceof Error ? welcomeErr.message : "Erreur inconnue"}`);
      }
      
      // ✅ REDIRECTION VERS LA PAGE DE CONNEXION MESSAGERIE avec paramètre ref pour l'admin
      setTimeout(() => {
        router.push(`/messagerie/connexion?message=compte_active&ref=${encodeURIComponent(email.toLowerCase())}`);
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  // Vérification directe sans useEffect
  if (!token || !email) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4">Lien invalide</h2>
          <p className="text-zinc-500 text-sm mb-6">
            Le lien de confirmation est invalide ou a expiré.
          </p>
          <Link
            href="/messagerie/inscription"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-black py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition-colors"
          >
            Nouvelle demande
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4">Mot de passe défini</h2>
          <p className="text-zinc-400 text-sm mb-2">
            Votre compte est maintenant actif.
          </p>
          <p className="text-zinc-500 text-xs mb-6">
            Vous allez être redirigé vers la page de connexion...
          </p>
          <div className="flex justify-center">
            <RefreshCcw className="w-5 h-5 text-red-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 font-sans relative">
      
      {/* Navigation */}
      <div className="absolute top-8 left-8 z-50">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
      </div>

      <div className="max-w-md mx-auto">
        
        {/* En-tête */}
        <div className="text-center mb-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-6">
            Sécurisation du compte
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-3">
            DÉFINIR MON <span className="text-red-600">MOT DE PASSE</span>
          </h1>
          <p className="text-zinc-500 text-xs max-w-md mx-auto">
            Créez un mot de passe sécurisé pour accéder à votre messagerie privée.
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-6">
          
          {error && (
            <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
            </div>
          )}

          {/* Email (lecture seule) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Compte
            </label>
            <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
              {email}
            </div>
          </div>

          {/* Mot de passe */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Mot de passe *
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 w-4 h-4 text-zinc-700" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 pl-12 text-sm focus:border-red-600 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4 text-zinc-600 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-wider">
              8 caractères minimum, 1 majuscule, 1 minuscule, 1 chiffre, 1 symbole
            </p>
          </div>

          {/* Confirmation mot de passe */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Confirmer le mot de passe *
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 w-4 h-4 text-zinc-700" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 pl-12 text-sm focus:border-red-600 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-4 text-zinc-600 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {loading ? "Enregistrement..." : "Définir mon mot de passe"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-zinc-700">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[7px] uppercase tracking-widest">Transmission chiffrée</span>
          </div>
          <p className="text-[6px] text-zinc-800 uppercase tracking-[0.3em]">
            VAGONDYS — Sécurisation du compte — 2026
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Page principale avec Suspense pour useSearchParams
 */
export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  );
}
