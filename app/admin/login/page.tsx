
"use client";

import { useState } from "react";
import { createStaffClient } from "@/lib/supabase/client";
import { Lock, Mail, Loader2 } from "lucide-react";
import Image from "next/image";

/**
 * PAGE DE CONNEXION ADMIN
 * Copie de la page staff/login qui fonctionne
 * Accessible via admin.vagondys.com/admin/login
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const supabase = createStaffClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMsg("ACCÈS REFUSÉ : IDENTIFIANTS INCORRECTS.");
        setLoading(false);
      } else if (data?.user) {
        // Vérifier que l'utilisateur est bien admin@vagondys.com
        if (data.user.email !== "admin@vagondys.com") {
          await supabase.auth.signOut();
          setErrorMsg("ACCÈS RÉSERVÉ À L'ADMINISTRATEUR.");
          setLoading(false);
          return;
        }
        window.location.href = "/admin";
      }
    } catch (err) {
      console.error("Erreur critique login admin:", err);
      setErrorMsg("ERREUR SYSTÈME. VEUILLEZ RÉESSAYER.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-neutral-100 px-6 py-10">
      
      {/* Header */}
      <div className="flex flex-col items-center mb-8 md:mb-12 text-center">
        <div className="relative w-32 h-32 md:w-44 md:h-44 mb-6 md:mb-8">
          <Image
            src="/logo/vagondys-mark.png"
            alt="VAGONDYS"
            fill
            priority
            className="object-contain"
          />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[0.2em] md:tracking-widest text-red-500 uppercase">
          VAGONDYS
        </h1>
        <p className="mt-4 text-[10px] md:text-xs uppercase tracking-[0.3em] md:tracking-[0.4em] text-neutral-500">
          Administration — Niveau Super Admin
        </p>
      </div>

      {/* Formulaire */}
      <div className="w-full max-w-sm border-t border-neutral-800 bg-neutral-950/50 p-8 md:p-10 rounded-2xl shadow-2xl">
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-neutral-500 ml-1">
              Identifiant
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-neutral-700" />
              <input
                type="email"
                placeholder="admin@vagondys.com"
                className="w-full pl-10 pr-4 py-3 bg-black border border-neutral-800 text-white rounded-lg focus:border-red-500 outline-none transition-all placeholder:text-neutral-800 text-sm"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-neutral-500 ml-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-neutral-700" />
              <input
                type="password"
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-black border border-neutral-800 text-white rounded-lg focus:border-red-500 outline-none transition-all placeholder:text-neutral-800 text-sm"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-[10px] text-red-500 uppercase tracking-widest text-center animate-pulse">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg tracking-[0.2em] transition-all flex items-center justify-center text-xs active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "ENTRER DANS L'ADMINISTRATION"
            )}
          </button>
        </form>
      </div>

      <p className="mt-10 md:mt-12 text-[9px] md:text-[10px] uppercase tracking-[0.4em] md:tracking-[0.5em] text-neutral-700 text-center">
        Supervision Globale • Toutes les stations
      </p>
    </main>
  );
}
