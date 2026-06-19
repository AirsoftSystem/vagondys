
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  RefreshCcw,
  ChevronRight
} from "lucide-react";

/**
 * Page de connexion pour l'Admin (Master)
 * URL : /admin/login
 * 
 * ✅ Vérifie les identifiants directement via Supabase (admin_config)
 * ✅ Stocke la session dans sessionStorage (admin_authenticated)
 * ✅ Redirige vers /admin/dashboard
 * 
 * ✅ CORRECTION 2026-06-24 : Utilisation directe de Supabase au lieu de l'API
 * La table admin_config contient le mot de passe admin
 */
export default function AdminLoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Soumission du formulaire
   * Vérifie les identifiants directement dans Supabase
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validation basique
    if (!email.trim() || !password.trim()) {
      setError("Veuillez renseigner votre email et mot de passe.");
      setLoading(false);
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier que l'email est autorisé (admin uniquement)
    const allowedEmails = ["admin@vagondys.com", "vagondys@gmail.com"];
    if (!allowedEmails.includes(normalizedEmail)) {
      setError("Accès non autorisé. Email invalide.");
      setLoading(false);
      return;
    }

    try {
      // Connexion à Supabase avec Service Role
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("❌ Variables Supabase manquantes");
        setError("Configuration serveur invalide");
        setLoading(false);
        return;
      }

      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Récupérer le mot de passe admin depuis admin_config
      const { data, error: fetchError } = await supabase
        .from("admin_config")
        .select("value")
        .eq("key", "admin_password")
        .maybeSingle();

      if (fetchError || !data) {
        console.error("❌ Erreur récupération mot de passe admin:", fetchError);
        setError("Configuration admin manquante");
        setLoading(false);
        return;
      }

      const storedPassword = data.value;

      // Vérifier le mot de passe
      if (password !== storedPassword) {
        setError("Mot de passe incorrect");
        setLoading(false);
        return;
      }

      // ✅ Succès - Stocker la session
      sessionStorage.setItem("admin_authenticated", "true");
      sessionStorage.setItem("admin_email", normalizedEmail);

      // ✅ Redirection vers le dashboard
      router.push("/admin/dashboard");
      router.refresh();

    } catch (err) {
      console.error("❌ Erreur connexion admin:", err);
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      
      {/* Effet de fond */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/10 rounded-full border border-red-600/20 mb-4">
            <ShieldCheck className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            Administration <span className="text-red-600">Master</span>
          </h1>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">
            Accès réservé — Supervision globale
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl">
          
          {/* Erreur */}
          {error && (
            <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-3 flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-[9px] font-black uppercase tracking-widest">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-700" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@vagondys.com"
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 pl-11 text-sm text-white focus:border-red-600 outline-none transition-colors placeholder:text-zinc-700"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-700" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 pl-11 pr-11 text-sm text-white focus:border-red-600 outline-none transition-colors placeholder:text-zinc-700"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-zinc-600 hover:text-white transition-colors"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Bouton de connexion */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {loading ? "Connexion..." : "Accéder au dashboard"}
          </button>

          {/* Note de sécurité */}
          <p className="text-center text-[7px] text-zinc-600 uppercase tracking-widest">
            Accès réservé aux administrateurs du réseau VAGONDYS
          </p>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-[7px] text-zinc-700 hover:text-zinc-500 uppercase tracking-widest transition-colors"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[6px] text-zinc-800 uppercase tracking-[0.3em]">
            VAGONDYS — Administration sécurisée — 2026
          </p>
        </div>
      </div>
    </div>
  );
}
