
"use client";

import React, { useState } from 'react';
import {
  Home,
  Calendar,
  MapPin,
  Users,
  Trophy,
  Award,
  ChevronRight,
  X,
  Eye
} from "lucide-react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================
type EventStatus = 'UPCOMING' | 'ONGOING' | 'PAST';
type EventType = 'TOURNAMENT' | 'WORKSHOP' | 'MEETUP' | 'CONFERENCE';

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  city: string;
  type: EventType;
  status: EventStatus;
  image: string;
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  price: number;
  winnerName?: string;
}

// ============================================================
// CONFIGURATION
// ============================================================
const EVENTS: Event[] = [
  {
    id: "elite-grind-06",
    title: "AS-ELITE GRIND",
    date: "2025-06-15",
    location: "Complexe Sportif, Nantes",
    city: "NANTES",
    type: "TOURNAMENT",
    status: "UPCOMING",
    image: "/events/elite-grind.jpg",
    description: "Le monument du storytelling VAGONDYS. Les 8 Têtes de Série mondiales défendent leur statut.",
    maxParticipants: 8,
    currentParticipants: 8,
    price: 150
  },
  {
    id: "ums-07",
    title: "ULTIMATE MASTER SUPREME",
    date: "2025-07-20",
    location: "Palais des Sports, Paris",
    city: "PARIS",
    type: "TOURNAMENT",
    status: "UPCOMING",
    image: "/events/ums.jpg",
    description: "Circuit PRO Majeur. Accès aux Cash Prizes mondiaux.",
    maxParticipants: 64,
    currentParticipants: 42,
    price: 80
  },
  {
    id: "workshop-gbb",
    title: "WORKSHOP PRÉCISION GBB",
    date: "2025-05-10",
    location: "Stand VAGONDYS, Nantes",
    city: "NANTES",
    type: "WORKSHOP",
    status: "PAST",
    image: "/events/workshop.jpg",
    description: "Maîtrise du recul et correction balistique.",
    maxParticipants: 20,
    currentParticipants: 20,
    price: 45,
    winnerName: "Cible-Alpha"
  }
];

const TYPE_CONFIG: Record<EventType, { label: string; icon: React.ReactNode; badgeStyle: string }> = {
  TOURNAMENT: {
    label: "Tournoi",
    icon: <Trophy className="w-3 h-3" />,
    badgeStyle: "border-red-600/30 text-red-500"
  },
  WORKSHOP: {
    label: "Atelier",
    icon: <Users className="w-3 h-3" />,
    badgeStyle: "border-blue-500/30 text-blue-500"
  },
  MEETUP: {
    label: "Rencontre",
    icon: <Users className="w-3 h-3" />,
    badgeStyle: "border-green-500/30 text-green-500"
  },
  CONFERENCE: {
    label: "Conférence",
    icon: <Award className="w-3 h-3" />,
    badgeStyle: "border-purple-500/30 text-purple-500"
  }
};

const STATUS_CONFIG: Record<EventStatus, { label: string; badgeStyle: string }> = {
  UPCOMING: { label: "À venir", badgeStyle: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  ONGOING: { label: "En cours", badgeStyle: "text-green-500 bg-green-500/10 border-green-500/20" },
  PAST: { label: "Terminé", badgeStyle: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" }
};

// ============================================================
// UTILS
// ============================================================
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function EvenementielsPage() {
  const [selectedType, setSelectedType] = useState<EventType | "all">("all");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const filteredEvents = EVENTS.filter((event) => {
    if (selectedType !== "all" && event.type !== selectedType) return false;
    return true;
  });

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
            ÉVÉNEMENTIELS
          </div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase mb-6 italic leading-none">
            CALENDRIER <span className="text-red-600">DES ÉVÉNEMENTS</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-[0.2em] uppercase max-w-2xl mx-auto text-sm leading-relaxed">
            Tournois, ateliers, conférences — Programme officiel de la Maison VAGONDYS
          </p>
        </header>

        {/* ===== FILTRES ===== */}
        <div className="flex flex-wrap gap-4 mb-12 justify-center">
          <button
            onClick={() => setSelectedType("all")}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedType === "all"
                ? "bg-red-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
            }`}
          >
            Tous
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedType(key as EventType)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                selectedType === key
                  ? "bg-red-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          ))}
        </div>

        {/* ===== GRILLE ÉVÉNEMENTS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <article
              key={event.id}
              className="group bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden hover:border-red-600 transition-all hover:scale-[1.02] duration-300"
            >
              {/* Image placeholder */}
              <div className="h-48 bg-linear-to-br from-zinc-900 to-black relative flex items-center justify-center border-b border-zinc-800">
                <Calendar className="w-12 h-12 text-zinc-700 group-hover:text-red-600 transition-colors" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`text-[8px] font-black px-2 py-1 rounded-full border ${STATUS_CONFIG[event.status].badgeStyle}`}>
                    {STATUS_CONFIG[event.status].label}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {/* Badge type */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${TYPE_CONFIG[event.type].badgeStyle} flex items-center gap-1`}>
                    {TYPE_CONFIG[event.type].icon}
                    {TYPE_CONFIG[event.type].label}
                  </span>
                  <span className="text-[8px] text-zinc-600 uppercase tracking-wider">{event.city}</span>
                </div>

                {/* Titre */}
                <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2 group-hover:text-red-600 transition-colors">
                  {event.title}
                </h3>

                {/* Description */}
                <p className="text-zinc-500 text-xs leading-relaxed mb-4 line-clamp-2">
                  {event.description}
                </p>

                {/* Infos */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-zinc-400 text-[10px]">
                    <Calendar size={12} className="text-red-600" />
                    <span>{formatDate(event.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-[10px]">
                    <MapPin size={12} className="text-red-600" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-[10px]">
                    <Users size={12} className="text-red-600" />
                    <span>{event.currentParticipants} / {event.maxParticipants} inscrits</span>
                  </div>
                </div>

                {/* Prix + action */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div>
                    <span className="text-[8px] text-zinc-600 uppercase">À partir de</span>
                    <p className="text-xl font-black text-red-600">{event.price}€</p>
                  </div>
                  {event.status === "PAST" ? (
                    <button
                      onClick={() => setSelectedEvent(event)}
                      className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-red-600 transition-colors"
                    >
                      <Eye size={12} /> Résultats
                    </button>
                  ) : (
                    <Link
                      href={`/reservations?event=${event.id}`}
                      className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-red-600 transition-colors"
                    >
                      S&apos;inscrire
                      <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ===== AUCUN RÉSULTAT ===== */}
        {filteredEvents.length === 0 && (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Aucun événement trouvé</p>
            <p className="text-zinc-600 text-sm mt-1">Modifiez vos filtres pour voir plus d&apos;événements</p>
          </div>
        )}

        {/* ===== NEWSLETTER ===== */}
        <section className="mt-24 bg-zinc-950 border border-zinc-800 rounded-2xl p-12 text-center">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4">RESTEZ INFORMÉ</h2>
          <p className="text-zinc-500 text-sm max-w-2xl mx-auto mb-8">
            Inscrivez-vous à la newsletter pour recevoir les annonces des prochains événements
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Votre email"
              className="flex-1 bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none"
            />
            <button className="px-6 py-3 bg-red-600 text-white font-black uppercase tracking-wider text-[10px] rounded-lg hover:bg-white hover:text-black transition-all">
              S&apos;abonner
            </button>
          </div>
        </section>

        {/* ===== MODAL LOUPE (RÉSULTATS) ===== */}
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{selectedEvent.title}</h2>
                  <p className="text-xs text-zinc-500">{formatDate(selectedEvent.date)}</p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-6 text-center">
                  <Trophy className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Vainqueur</p>
                  <p className="text-2xl font-black italic text-white">
                    {selectedEvent.winnerName || "Non déterminé"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-full bg-red-600 text-white py-3 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white hover:text-black transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== FOOTER DÉCORATIF ===== */}
        <footer className="mt-20 flex flex-col items-center gap-6 pb-12">
          <div className="w-12 h-px bg-zinc-900" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] text-zinc-700 uppercase tracking-[0.6em] font-black">Vagondys Event Cell</p>
            <p className="text-[8px] text-zinc-800 uppercase tracking-[0.4em]">Programme Officiel — 2026</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
