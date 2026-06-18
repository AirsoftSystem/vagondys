
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
  Hash,
  Tag
} from "lucide-react";
import Link from "next/link";

/**
 * PAGE INSCRIPTION - VAGONDYS
 * Version "City-Aware" : Identifie la ville et communique avec le Master/GitHub spécifique.
 * ✅ AJOUT : Géolocalisation par IP pour pré-remplir la ville la plus proche
 * ✅ CORRECTION : URL de recherche GitHub corrigée (/find-by-email)
 * ✅ CORRECTION : Suppression des variables inutilisées cityCode/countryCode (ESLint)
 * ✅ AJOUT : Menu déroulant "Type de demande" (Client, Communication, Divers, Fournisseur, Partenaire, Publicité, Sponsor)
 * ✅ CORRECTION : Texte simplifié pour le champ "Motif de la demande"
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

// ✅ Liste des villes avec leurs coordonnées pour la géolocalisation
const CITIES_COORDINATES = [
  { name: "Nantes", lat: 47.2184, lon: -1.5536, country: "FR" },
  { name: "Lyon", lat: 45.7640, lon: 4.8357, country: "FR" },
  { name: "Paris", lat: 48.8566, lon: 2.3522, country: "FR" },
  { name: "Marseille", lat: 43.2965, lon: 5.3698, country: "FR" },
  { name: "Bordeaux", lat: 44.8378, lon: -0.5792, country: "FR" },
  { name: "Lille", lat: 50.6292, lon: 3.0573, country: "FR" },
  { name: "Toulouse", lat: 43.6047, lon: 1.4442, country: "FR" },
  { name: "Madrid", lat: 40.4168, lon: -3.7038, country: "ES" }
];

// ✅ Types disponibles (ordre alphabétique)
const REQUEST_TYPES = [
  { value: "client", label: "Client" },
  { value: "communication", label: "Communication" },
  { value: "divers", label: "Divers" },
  { value: "supplier", label: "Fournisseur" },
  { value: "partner", label: "Partenaire" },
  { value: "advertising", label: "Publicité" },
  { value: "sponsor", label: "Sponsor" }
];

export default function InscriptionJoueurPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    pseudo: "",
    email: "",
    phone: "",
    password: "",
    country_select: "FR",
    city: "Nantes",
    type: "partner", // ✅ AJOUT : Type de demande (par défaut "Partenaire")
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoDetectionDone, setGeoDetectionDone] = useState(false);

  // États pour la vérification d'archive
  const [dossierRef, setDossierRef] = useState("0");
  const [isChecking, setIsChecking] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  // ✅ NOUVEAU : Géolocalisation par IP pour déterminer la ville la plus proche
  useEffect(() => {
    const detectLocationByIP = async () => {
      if (geoDetectionDone) return;
      
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data && data.country_code) {
          const countryCode = data.country_code.toUpperCase();
          const country = countryCode === 'ES' ? 'ES' : 'FR';
          
          const userLat = data.latitude;
          const userLon = data.longitude;
          
          if (userLat && userLon) {
            // Filtrer par pays détecté
            const filteredCities = CITIES_COORDINATES.filter(c => c.country === country);
            
            // Calculer la distance et trouver la ville la plus proche
            let closestCity = filteredCities[0];
            let minDistance = Infinity;
            
            for (const city of filteredCities) {
              const R = 6371; // Rayon de la Terre en km
              const dLat = (city.lat - userLat) * Math.PI / 180;
              const dLon = (city.lon - userLon) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(userLat * Math.PI / 180) * Math.cos(city.lat * Math.PI / 180) *
                        Math.sin(dLon/2) * Math.sin(dLon/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const distance = R * c;
              
              if (distance < minDistance) {
                minDistance = distance;
                closestCity = city;
              }
            }
            
            if (closestCity) {
              setFormData(prev => ({
                ...prev,
                country_select: closestCity.country,
                city: closestCity.name
              }));
              setGeoDetectionDone(true);
              console.log(`📍 Géolocalisation: Ville détectée = ${closestCity.name} (distance: ${minDistance.toFixed(0)} km)`);
            }
          }
        }
      } catch {
        console.log('⚠️ Géolocalisation IP non disponible, utilisation des valeurs par défaut');
      }
    };
    
    detectLocationByIP();
  }, [geoDetectionDone]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Effet de vérification de l'email
  useEffect(() => {
    const checkExistingDossier = async () => {
      if (formData.email.includes('@') && formData.email.includes('.')) {
        setIsChecking(true);
        try {
          const emailSlug = formData.email.toLowerCase().trim().replace('@', '_');
          
          const res = await fetch(`/api/archive-external/find-by-email?search=${emailSlug}`);
          
          if (res.ok) {
            const data = await res.json();
            if (data && data.dossier_ref) {
              setDossierRef(data.dossier_ref);
              console.log(`✅ Dossier existant trouvé: ${data.dossier_ref}`);
            } else {
              setDossierRef("0");
            }
          } else {
            console.warn(`⚠️ Recherche GitHub échouée: ${res.status}`);
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

  // Gestion du captcha Cloudflare Turnstile
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
        type: formData.type, // ✅ AJOUT : Type de demande
        turnstileToken: turnstileToken,
        dossierRef: dossierRef 
      };

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
                  <option value="FR">FRANCE</option>
                  <option value="ES">ESPAGNE</option>
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
                  <option value="Nantes">NANTES</option>
                  <option value="Lyon">LYON</option>
                  <option value="Paris">PARIS</option>
                  <option value="Marseille">MARSEILLE</option>
                  <option value="Bordeaux">BORDEAUX</option>
                  <option value="Lille">LILLE</option>
                  <option value="Toulouse">TOULOUSE</option>
                  <option value="Madrid">MADRID</option>
                </select>
              </div>
            </div>
          </div>

          {/* ✅ AJOUT : Menu déroulant "Type de demande" */}
          <div className="space-y-2">
            <label htmlFor="type" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Tag className="w-3 h-3 text-red-600" />
              Type de demande
            </label>
            <div className="relative">
              <select 
                id="type" 
                name="type"
                value={formData.type} 
                onChange={handleInputChange}
                className="w-full bg-black border border-zinc-900 rounded-xl p-4 pl-4 text-xs font-bold outline-none focus:border-red-600 transition-all appearance-none text-white cursor-pointer"
              >
                {REQUEST_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600 text-[8px]">▼</div>
            </div>
            <p className="text-[8px] text-zinc-600 uppercase tracking-wider ml-1">
              Sélectionnez le type de votre demande pour un traitement adapté
            </p>
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
