
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminVerificationPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminPasswordHash, setAdminPasswordHash] = useState<string | null>(null);

  // ✅ Récupérer le mot de passe depuis Supabase (Service Role)
  useEffect(() => {
    const fetchAdminPassword = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("❌ Variables Supabase manquantes");
          setError("Configuration serveur invalide");
          return;
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data, error } = await supabase
          .from("admin_config")
          .select("value")
          .eq("key", "admin_password")
          .maybeSingle();

        if (error || !data) {
          console.error("❌ Erreur récupération mot de passe admin:", error);
          setError("Configuration admin manquante");
          return;
        }

        console.log("✅ Mot de passe admin récupéré avec succès");
        setAdminPasswordHash(data.value);
      } catch (err) {
        console.error("❌ Erreur lors de la récupération:", err);
        setError("Impossible de charger la configuration");
      }
    };

    fetchAdminPassword();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!password.trim()) {
      setError("Veuillez saisir le mot de passe d'administration.");
      setLoading(false);
      return;
    }

    if (!adminPasswordHash) {
      setError("Configuration admin non disponible.");
      setLoading(false);
      return;
    }

    // Simulation d'un délai pour l'effet de chargement
    await new Promise(resolve => setTimeout(resolve, 500));

    if (password.trim() === adminPasswordHash) {
      // ✅ Stocker dans sessionStorage que l'admin est authentifié
      sessionStorage.setItem("admin_authenticated", "true");
      // ✅ Redirection vers le nouveau chemin du dashboard admin
      router.push("/admin/dashboard");
    } else {
      setError("Mot de passe incorrect.");
      setPassword("");
      setLoading(false);
    }
  };

  if (!adminPasswordHash && !error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 text-[10px] uppercase tracking-widest">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        
        <div className="mb-6">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/10 rounded-full border border-red-600/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              Accès <span className="text-red-600">Administration</span>
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2">
              Zone réservée • Authentification requise
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-3 flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-[9px] font-black uppercase tracking-widest">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Mot de passe d&apos;administration
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-700" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full bg-black border border-zinc-800 rounded-xl p-3 pl-11 text-sm focus:border-red-600 outline-none transition-colors"
                />
              </div>
              <p className="text-[7px] text-zinc-700 uppercase tracking-wider">
                Mot de passe défini dans Supabase
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {loading ? "VÉRIFICATION..." : "ACCÉDER À L'ADMINISTRATION"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[7px] text-zinc-700 uppercase tracking-[0.3em]">
              VAGONDYS — Supervision globale
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
