"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  ArrowLeft, 
  Home,
  User, 
  Mail, 
  Lock, 
  Phone, 
  Fingerprint, 
  ShieldCheck, 
  MapPin,
  Globe,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Eye, 
  EyeOff,
  Hash
} from "lucide-react";
import Link from "next/link";

/**
 * PAGE INSCRIPTION - VAGONDYS
 * Version "City-Aware" : Identifie la ville et communique avec le Master/GitHub spécifique.
 */

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "outline";
};

type TurnstileWindow = Window & {
  turnstile?: {
    render: (element: string | HTMLElement, opts: TurnstileOptions) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
  };
};

export default function InscriptionJoueurPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    pseudo: "",
    email: "",
    phone: "",
    password: "",
    country_select: "FR", // Utilise maintenant les codes ISO pour la cohérence
    city: "Nantes", // Ville d'ancrage par défaut
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ÉTATS POUR LA VÉRIFICATION D'ARCHIVE (Conscience des dépôts par ville)
  const [dossierRef, setDossierRef] = useState("0");
  const [isChecking, setIsChecking] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // EFFET DE VÉRIFICATION DE L'EMAIL (Recherche "City-Aware" dans les archives GitHub)
  useEffect(() => {
    const checkExistingDossier = async () => {
      if (formData.email.includes('@') && formData.email.includes('.')) {
        setIsChecking(true);
        try {
          const emailSlug = formData.email.toLowerCase().trim().replace('@', '_');
          const cityCode = formData.city.toUpperCase();
          const countryCode = formData.country_select.toUpperCase();
          
          // Recherche avec prise en compte du pays et de la ville
          const res = await fetch(`/api/archive-external?search=${emailSlug}&city_code=${cityCode}&country_code=${countryCode}`);
          
          if (res.ok) {
            const text = await res.text();
            if (text) {
              const data = JSON.parse(text);
              if (data && data.ref) {
                setDossierRef(data.ref);
              } else {
                setDossierRef("0");
              }
            } else {
              setDossierRef("0");
            }
          } else {
            setDossierRef("0");
          }
        } catch (err) {
          console.error("Erreur check archive locale:", err);
          setDossierRef("0");
        } finally {
          setIsChecking(false);
        }
      } else {
        setDossierRef("0");
      }
    };

    const timer = setTimeout(checkExistingDossier, 800);
    return () => clearTimeout(timer);
  }, [formData.email, formData.city, formData.country_select]);

  // GESTION DU CAPTCHA CLOUDFLARE TURNSTILE
  useEffect(() => {
    const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!SITE_KEY) return;

    const scriptId = "cf-turnstile-script";
    
    const initTurnstile = () => {
      const win = window as TurnstileWindow;
      const container = document.getElementById("turnstile-container");
      if (win.turnstile && container && !widgetIdRef.current) {
        try {
          const id = win.turnstile.render("#turnstile-container", {
            sitekey: SITE_KEY,
            theme: "dark",
            callback: (token: string) => {
              setTurnstileToken(token);
              setError(null);
            },
            "error-callback": () => setError("ERREUR DE VÉRIFICATION CAPTCHA."),
            "expired-callback": () => {
              setTurnstileToken(null);
              setError("SESSION DE VÉRIFICATION EXPIRÉE.");
            }
          });
          
          if (id) {
            widgetIdRef.current = id;
          }
        } catch (e) {
          console.error("Turnstile render error", e);
        }
      }
    };

    if (!(window as TurnstileWindow).turnstile) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = initTurnstile;
      document.body.appendChild(script);
    } else {
      initTurnstile();
    }

    return () => {
      const win = window as TurnstileWindow;
      if (win.turnstile && widgetIdRef.current) {
        try {
          win.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {
          // Éviter crash
        }
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("SÉCURITÉ INSUFFISANTE : 8 CARACTÈRES (MAJ, MIN, CHIFFRE, SYMBOLE) REQUIS.");
      return;
    }

    if (!turnstileToken) {
      setError("MERCI DE COMPLÉTER LA VÉRIFICATION ANTI-BOT.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        pseudo: formData.pseudo || "",
        phone: formData.phone || "",
        city: formData.city.toUpperCase(), 
        country: formData.country_select.toUpperCase(),
        turnstileToken: turnstileToken,
        dossierRef: dossierRef 
      };

      // APPEL À L'API AUTH ( Dispatcher Master )
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === "signup_disabled") {
          throw new Error("LES INSCRIPTIONS DIRECTES SONT BLOQUÉES. CONTACTEZ L'ADMINISTRATEUR POUR ACTIVER LE MODE ADMIN SUR L'API.");
        }
        throw new Error(result.error || "ERREUR LORS DE L'INSCRIPTION");
      }

      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "UNE ERREUR INCONNUE EST SURVENUE";
      setError(msg.toUpperCase());

      const win = window as TurnstileWindow;
      if (win.turnstile && widgetIdRef.current) {
        win.turnstile.reset(widgetIdRef.current);
      }
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center space-y-6">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">
            <span className="text-green-500">VAGONDYS</span> <span className="text-white">{formData.city.toUpperCase()} ({formData.country_select.toUpperCase()})</span>
          </h1>
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">VÉRIFIE TES EMAILS</h2>
          <p className="text-zinc-500 text-xs font-bold leading-relaxed uppercase tracking-widest">
            Un lien de confirmation a été envoyé à <span className="text-green-500">{formData.email}</span>.<br/>
            Ton dossier pour l&apos;unité <span className="text-green-500">{formData.city.toUpperCase()} ({formData.country_select.toUpperCase()})</span> sera généré après validation.
          </p>
          <Link 
            href="/connexion" 
            className="block w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] transition-transform active:scale-95"
          >
            RETOUR À LA CONNEXION
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
        <nav className="absolute top-8 left-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 h-auto sm:h-4">
          <Link href="/" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group">
            <Home className="w-4 h-4 text-red-600" /> VAGONDYS
          </Link>
          <div className="hidden sm:block w-px h-4 bg-zinc-900" />
          <Link href="/joueurs" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            Retour Bibliothèque
          </Link>
        </nav>
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            <span className= "text-red-600">VAGONDYS</span> <span className="text-white">{formData.city.toUpperCase()} ({formData.country_select.toUpperCase()})</span>
          </h1>
          <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em]">Section Recrutement Officielle</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 md:p-12 shadow-2xl space-y-6">
          
          {error && (
            <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
              <AlertTriangle size={18} />
              <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="full_name" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identité Complète</label>
              <div className="relative">
                <User className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
                <input 
                  id="full_name" 
                  name="full_name" 
                  type="text" 
                  required 
                  placeholder="NOM PRÉNOM" 
                  value={formData.full_name} 
                  onChange={handleInputChange} 
                  className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none focus:border-red-600 transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="pseudo" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Alias / Pseudo</label>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
                <input 
                  id="pseudo" 
                  name="pseudo" 
                  type="text" 
                  placeholder="VGD_PLAYER" 
                  value={formData.pseudo} 
                  onChange={handleInputChange} 
                  className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none focus:border-red-600 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end px-1">
              <label htmlFor="email" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Adresse Email</label>
              {isChecking && <span className="text-[8px] text-red-600 animate-pulse font-black uppercase">Vérification archive...</span>}
              {!isChecking && dossierRef !== "0" && (
                <span className="text-[8px] text-green-500 font-black uppercase flex items-center gap-1">
                  <Hash size={10}/> Dossier {dossierRef} détecté dans {formData.city.toUpperCase()} ({formData.country_select.toUpperCase()})
                </span>
              )}
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
              <input 
                id="email" 
                name="email" 
                type="email" 
                required 
                placeholder="votre@email.com" 
                value={formData.email} 
                onChange={handleInputChange} 
                className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none focus:border-red-600 transition-all font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
                <input 
                  id="phone" 
                  name="phone" 
                  type="tel" 
                  placeholder="06..." 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none focus:border-red-600 transition-all font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Clé d&apos;accès</label>
              <div className="relative">
                <Lock className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
                <input 
                  id="password" 
                  name="password" 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••" 
                  value={formData.password} 
                  onChange={handleInputChange} 
                  className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none focus:border-red-600 transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-4 text-zinc-800 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="country_select" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Pays d&apos;affectation</label>
              <div className="relative">
                <Globe className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
                <select 
                  id="country_select" 
                  name="country_select"
                  value={formData.country_select} 
                  onChange={handleInputChange}
                  className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none appearance-none text-zinc-400"
                >
                  <option value="FR">FRANCE (VALIDE)</option>
                  <option value="ES">ESPAGNE (EN COURS)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="city" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ville d&apos;inscription</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 w-4 h-4 text-zinc-800" />
                <select 
                  id="city" 
                  name="city" 
                  value={formData.city} 
                  onChange={handleInputChange} 
                  className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-12 text-xs font-bold outline-none focus:border-red-600 transition-all appearance-none"
                >
                  <option value="Nantes">NANTES (ACTIF)</option>
                  <option value="Lyon">LYON (TEST)</option>
                  <option value="Madrid">MADRID (PRÉVU)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-2 min-h-[65px]">
            <div id="turnstile-container"></div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-white hover:text-black text-white font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            <span>{loading ? "TRAITEMENT EN COURS..." : "SOUMETTRE MON DOSSIER"}</span>
          </button>
        </form>

        <p className="text-center text-[9px] font-black text-zinc-700 uppercase tracking-widest">
          Déjà enrôlé ? <Link href="/connexion" className="text-white hover:text-red-600 transition-colors">Se connecter ici</Link>
        </p>

      </div>
    </div>
  );
}
