
"use client";

import React, { useState } from 'react';
import {
  Home,
  Trophy,
  Users,
  Target,
  Shield,
  Award,
  Mail,
  Globe,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  ExternalLink
} from "lucide-react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
interface Sponsor {
  id: number;
  name: string;
  logo: string;
  description: string;
  website: string;
  category: 'platinum' | 'gold' | 'silver' | 'bronze' | 'partner';
  since: number;
  social?: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
    facebook?: string;
  };
}

// ============================================================
// DONNÉES DE DÉMONSTRATION
// ============================================================
const SPONSORS: Sponsor[] = [
  {
    id: 1,
    name: "UMBRELLA CORP",
    logo: "/sponsors/umbrella.png",
    description: "Leader mondial des technologies immersives et équipements de simulation.",
    website: "https://umbrella-corp.com",
    category: "platinum",
    since: 2022,
    social: {
      linkedin: "https://linkedin.com/company/umbrella",
      twitter: "https://twitter.com/umbrella",
      instagram: "https://instagram.com/umbrella"
    }
  },
  {
    id: 2,
    name: "CYBERDYNE SYSTEMS",
    logo: "/sponsors/cyberdyne.png",
    description: "Solutions de tracking et intelligence artificielle pour le sport de précision.",
    website: "https://cyberdyne.com",
    category: "platinum",
    since: 2023,
    social: {
      linkedin: "https://linkedin.com/company/cyberdyne",
      twitter: "https://twitter.com/cyberdyne"
    }
  },
  {
    id: 3,
    name: "WEYLAND-YUTANI",
    logo: "/sponsors/weyland.png",
    description: "Équipements biométriques et analyse de performance en temps réel.",
    website: "https://weyland-yutani.com",
    category: "gold",
    since: 2022,
    social: {
      linkedin: "https://linkedin.com/company/weyland",
      instagram: "https://instagram.com/weyland"
    }
  },
  {
    id: 4,
    name: "SARIF INDUSTRIES",
    logo: "/sponsors/sarif.png",
    description: "Fabricant de prothèses et équipements augmentés pour athlètes d'élite.",
    website: "https://sarifindustries.com",
    category: "gold",
    since: 2024,
    social: {
      twitter: "https://twitter.com/sarif",
      linkedin: "https://linkedin.com/company/sarif"
    }
  },
  {
    id: 5,
    name: "ARMACHAM TECHNOLOGY",
    logo: "/sponsors/armacham.png",
    description: "Matériel de simulation balistique dernière génération.",
    website: "https://armacham.com",
    category: "silver",
    since: 2023,
    social: {
      instagram: "https://instagram.com/armacham"
    }
  },
  {
    id: 6,
    name: "OCP",
    logo: "/sponsors/ocp.png",
    description: "Logistique et infrastructure des événements VAGONDYS.",
    website: "https://ocp.com",
    category: "silver",
    since: 2022,
    social: {
      linkedin: "https://linkedin.com/company/ocp"
    }
  },
  {
    id: 7,
    name: "TYRELL CORPORATION",
    logo: "/sponsors/tyrell.png",
    description: "Solutions d'éclairage et environnement 4DX.",
    website: "https://tyrell.com",
    category: "bronze",
    since: 2024
  },
  {
    id: 8,
    name: "INVALID SRL",
    logo: "/sponsors/invalid.png",
    description: "Développement de l'interface logicielle VAGONDYS.",
    website: "https://invalid.com",
    category: "partner",
    since: 2022
  }
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  platinum: {
    label: "Platine",
    color: "text-purple-400",
    bgColor: "bg-purple-950/30",
    borderColor: "border-purple-500/30"
  },
  gold: {
    label: "Or",
    color: "text-yellow-500",
    bgColor: "bg-yellow-950/30",
    borderColor: "border-yellow-500/30"
  },
  silver: {
    label: "Argent",
    color: "text-gray-400",
    bgColor: "bg-gray-950/30",
    borderColor: "border-gray-500/30"
  },
  bronze: {
    label: "Bronze",
    color: "text-amber-600",
    bgColor: "bg-amber-950/30",
    borderColor: "border-amber-600/30"
  },
  partner: {
    label: "Partenaire",
    color: "text-blue-400",
    bgColor: "bg-blue-950/30",
    borderColor: "border-blue-500/30"
  }
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function SponsorsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredSponsors = SPONSORS.filter(sponsor => {
    if (selectedCategory === "all") return true;
    return sponsor.category === selectedCategory;
  });

  const getSocialIcon = (platform: string) => {
    switch(platform) {
      case 'linkedin': return <Linkedin className="w-3 h-3" />;
      case 'twitter': return <Twitter className="w-3 h-3" />;
      case 'instagram': return <Instagram className="w-3 h-3" />;
      case 'facebook': return <Facebook className="w-3 h-3" />;
      default: return <Globe className="w-3 h-3" />;
    }
  };

  return (
    <main className="min-h-screen bg-black text-white px-6 py-24 selection:bg-red-600 font-sans relative">

      {/* ===== NAVIGATION HAUTE GAUCHE ===== */}
      <div className="absolute top-8 left-8 z-50">
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
        >
          <Home className="w-4 h-4 text-red-600" /> VAGONDYS
        </Link>
      </div>

      <div className="max-w-7xl mx-auto">

        {/* ===== HEADER ===== */}
        <header className="mb-20 text-center pt-10">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-10 animate-pulse">
            PARTENAIRES OFFICIELS
          </div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            NOS <span className="text-red-600">SPONSORS</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-2xl mx-auto text-sm leading-relaxed">
            Découvrez les entreprises qui soutiennent la Maison VAGONDYS
          </p>
        </header>

        {/* ===== FILTRES ===== */}
        <div className="flex flex-wrap gap-3 mb-12 justify-center">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedCategory === "all"
                ? "bg-red-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            Tous
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
                selectedCategory === key
                  ? `${config.bgColor} ${config.color} border ${config.borderColor}`
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        {/* ===== GRILLE DES SPONSORS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSponsors.map((sponsor) => {
            const config = CATEGORY_CONFIG[sponsor.category];
            return (
              <div
                key={sponsor.id}
                className={`group bg-zinc-950 border rounded-2xl overflow-hidden hover:scale-[1.02] transition-all duration-300 ${config.borderColor}`}
              >
                {/* Logo placeholder */}
                <div className={`h-40 flex items-center justify-center border-b ${config.borderColor} bg-black/50`}>
                  <div className="w-24 h-24 bg-zinc-800 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl font-black italic text-zinc-600">{sponsor.name.charAt(0)}</span>
                  </div>
                </div>

                <div className="p-5">
                  {/* Badge catégorie */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[7px] font-black px-2 py-0.5 rounded-full border ${config.bgColor} ${config.color} ${config.borderColor}`}>
                      {config.label}
                    </span>
                    <span className="text-[7px] text-zinc-600">Depuis {sponsor.since}</span>
                  </div>

                  {/* Nom */}
                  <h3 className="text-lg font-black uppercase tracking-tighter mb-2 group-hover:text-red-600 transition-colors">
                    {sponsor.name}
                  </h3>

                  {/* Description */}
                  <p className="text-zinc-500 text-[10px] leading-relaxed mb-4 line-clamp-2">
                    {sponsor.description}
                  </p>

                  {/* Liens */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-2">
                      {sponsor.social && Object.entries(sponsor.social).map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-red-600 transition-colors"
                          aria-label={`Suivre sur ${platform}`}
                        >
                          {getSocialIcon(platform)}
                        </a>
                      ))}
                    </div>
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-zinc-500 hover:text-red-600 transition-colors"
                    >
                      Site web
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== AUCUN RÉSULTAT ===== */}
        {filteredSponsors.length === 0 && (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucun sponsor trouvé</p>
            <p className="text-zinc-600 text-sm mt-1">Modifiez vos filtres pour voir plus de partenaires</p>
          </div>
        )}

        {/* ===== SECTION DEVENIR SPONSOR ===== */}
        <section className="mt-24 bg-zinc-950 border border-zinc-800 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4">
            DEVENIR <span className="text-red-600">PARTENAIRE</span>
          </h2>
          <p className="text-zinc-500 text-sm max-w-2xl mx-auto mb-8">
            Rejoignez l&apos;écosystème VAGONDYS et associez votre marque à l&apos;excellence du sport de précision.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="px-8 py-4 bg-red-600 text-white font-black uppercase tracking-wider text-[10px] rounded-xl hover:bg-white hover:text-black transition-all flex items-center gap-2"
            >
              <Mail size={14} /> Nous contacter
            </Link>
            <Link
              href="/communication"
              className="px-8 py-4 bg-zinc-800 text-white font-black uppercase tracking-wider text-[10px] rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
            >
              <Shield size={14} /> Dossier de sponsoring
            </Link>
          </div>
        </section>

        {/* ===== STATISTIQUES ===== */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <Trophy className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">{SPONSORS.length}</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Partenaires actifs</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <Award className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">5</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Catégories</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <Target className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">24</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Événements par an</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
            <Users className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <p className="text-2xl font-black text-white">500+</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Athlètes impactés</p>
          </div>
        </div>

        {/* ===== FOOTER DÉCORATIF ===== */}
        <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
          <div className="w-12 h-px bg-zinc-900" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Partnership Program</p>
            <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Rejoignez l&apos;élite — Depuis 2022</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
