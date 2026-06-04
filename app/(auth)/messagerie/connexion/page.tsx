
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createVagondysClient } from "@/lib/supabase/client";

export default function MessagerieConnexionPage() {
  const router = useRouter();
  const supabase = createVagondysClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !authData.user) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      const user = authData.user;
      const userId = user.id;

      const checkRes = await fetch("/api/messagerie/check-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const checkData = await checkRes.json();

      if (!checkData.exists || checkData.status !== "active") {
        console.log("🔍 Compte messagerie non actif, tentative de restauration depuis GitHub...");

        const dossierRef = user.user_metadata?.dossier_ref;
        if (!dossierRef) {
          console.warn("Aucun dossier_ref trouvé dans les métadonnées utilisateur.");
          setError("Impossible de restaurer le compte. Contactez le support.");
          setLoading(false);
          return;
        }

        const restoreRes = await fetch("/api/archive-external/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dossier_ref: dossierRef,
            city_code: user.user_metadata?.city || "NANTES",
            country_code: user.user_metadata?.country || "FR",
          }),
        });

        if (!restoreRes.ok) {
          const errorText = await restoreRes.text();
          console.error("Erreur restauration:", errorText);
          setError("Échec de la restauration du compte. Contactez le support.");
          setLoading(false);
          return;
        }

        console.log("✅ Compte restauré avec succès depuis GitHub");
      }

      router.push("/messagerie");
    } catch (err) {
      console.error("Erreur inattendue:", err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-md mx-auto px-4 pt-24 pb-12">
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-6">
            Accès sécurisé
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">
            Messagerie
          </h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest">
            Espace partenaire &mdash; authentification requise
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-600 transition-colors"
              placeholder="exemple@vagondys.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-600 transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-3 text-center">
              <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
                ⚠️ {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white font-black uppercase text-[11px] tracking-widest py-3 rounded-xl transition-colors"
          >
            {loading ? "Connexion en cours..." : "Accéder à ma messagerie"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/messagerie/inscription"
            className="text-[9px] text-zinc-500 hover:text-red-600 uppercase tracking-widest transition-colors"
          >
            Pas encore de compte&nbsp;? Faire une demande
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-[8px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition-colors"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>

        <footer className="mt-12 text-center text-[8px] text-zinc-600 uppercase tracking-widest">
          VAGONDYS &mdash; Messagerie sécurisée &mdash; 2026
        </footer>
      </div>
    </main>
  );
}
