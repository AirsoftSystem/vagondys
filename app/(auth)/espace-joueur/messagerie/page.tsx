
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCcw, ShieldCheck, MessageSquare, ArrowLeft, MapPin, Globe, Search, UserCog } from "lucide-react";
import Link from "next/link";
import { createVagondysClient } from "@/lib/supabase/client";
import {
  getPlayerConversation,
  getPlayerMessages,
  sendPlayerMessage,
} from "./actions";
import MessageInput from "@/app/(auth)/messagerie/components/MessageInput";
import MessageThread from "@/app/(auth)/messagerie/components/MessageThread";
import MessageList from "@/app/(auth)/messagerie/components/MessageList";

// Adaptation des types pour les composants existants
interface AdaptedConversation {
  dossier_ref: string;
  last_message: string;
  last_message_date: string;
  participant_name: string;
  participant_email: string;
  unread_count: number;
  created_at: string;
}

interface AdaptedMessage {
  id: string;
  content: string;
  created_at: string;
  sender: "user" | "staff" | "system";
  sender_name: string;
  document_url?: string | null;
}

// ✅ STRUCTURE DES VILLES PAR PAYS
const CITIES_BY_COUNTRY = {
  "FRANCE": [
    "BORDEAUX",
    "LILLE",
    "LYON",
    "MARSEILLE",
    "NANTES",
    "PARIS",
    "TOULOUSE"
  ],
  "ESPAGNE": [
    "MADRID"
  ]
};

// ✅ OBJETS DU SIGNAL (comme dans le formulaire de contact)
const SUBJECTS = [
  { value: "COMMUNICATION", label: "COMMUNICATION" },
  { value: "SPONSORS", label: "SPONSORS" },
  { value: "LIGUE", label: "LIGUE" },
  { value: "INSCRIPTION", label: "INSCRIPTION" },
  { value: "LICENCE", label: "LICENCE" },
  { value: "PLAYER", label: "PLAYER" },
  { value: "COMPETITION", label: "COMPETITION" },
  { value: "TOURNOIS", label: "TOURNOIS" },
  { value: "RESERVATIONS", label: "RESERVATIONS" }
];

/**
 * Page Messagerie pour l'espace joueur
 * ✅ CORRECTION : Messagerie 100% interne (pas d'email)
 * ✅ Le Super Admin est un rôle interne, pas un email
 */
export default function EspaceJoueurMessageriePage() {
  const router = useRouter();
  const supabase = createVagondysClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [conversation, setConversation] = useState<AdaptedConversation | null>(null);
  const [messages, setMessages] = useState<AdaptedMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ✅ ÉTATS POUR LA REFONTE
  const [selectedCountry, setSelectedCountry] = useState<string>("FRANCE");
  const [selectedCity, setSelectedCity] = useState<string>("MASTER");
  const [selectedSubject, setSelectedSubject] = useState<string>("COMMUNICATION");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(true);

  // 1. Vérifier l'authentification et charger la conversation
  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
          router.push("/connexion");
          return;
        }

        const userEmail = currentUser.email!;
        const userId = currentUser.id;
        const userName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.pseudo || "Joueur";

        setUser({ id: userId, email: userEmail, name: userName });

        const playerConv = await getPlayerConversation(userId, userEmail);

        if (!playerConv) {
          setError("Impossible de charger votre messagerie. Contactez le support.");
          setLoading(false);
          return;
        }

        const adaptedConv: AdaptedConversation = {
          dossier_ref: playerConv.dossier_ref,
          last_message: playerConv.last_message,
          last_message_date: playerConv.last_message_date,
          participant_name: playerConv.participant_name,
          participant_email: playerConv.participant_email,
          unread_count: 0,
          created_at: playerConv.created_at,
        };

        setConversation(adaptedConv);

        setLoadingMessages(true);
        const playerMessages = await getPlayerMessages(userId, userEmail, playerConv.dossier_ref);

        const adaptedMessages: AdaptedMessage[] = playerMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          sender: msg.sender === "player" ? "user" : (msg.sender === "staff" ? "staff" : "system"),
          sender_name: msg.sender_name,
          document_url: msg.document_url,
        }));

        setMessages(adaptedMessages);
        setLoadingMessages(false);
      } catch (err) {
        console.error("Erreur chargement messagerie:", err);
        setError("Erreur lors du chargement de la messagerie");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [supabase, router]);

  // 2. Envoyer un nouveau message
  const handleSendMessage = useCallback(async (content: string, fileUrl?: string, fileKey?: string) => {
    if (!conversation || !user) {
      throw new Error("Conversation non disponible");
    }

    // ✅ CORRECTION : Déterminer la destination UNIQUEMENT par la ville (messagerie 100% interne)
    // Super Admin = "MASTER" (rôle interne)
    const targetCity = isSuperAdmin ? "MASTER" : selectedCity;

    console.log(`📤 Envoi message - SuperAdmin: ${isSuperAdmin}, targetCity: ${targetCity}`);

    const result = await sendPlayerMessage({
      dossierRef: conversation.dossier_ref,
      content: content,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      targetCity: targetCity,
      subject: selectedSubject,
      fileUrl: fileUrl,
      fileKey: fileKey,
    });

    if (!result.success) {
      throw new Error(result.error || "Erreur d'envoi");
    }

    const updatedMessages = await getPlayerMessages(user.id, user.email, conversation.dossier_ref);
    const adaptedMessages: AdaptedMessage[] = updatedMessages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at,
      sender: msg.sender === "player" ? "user" : (msg.sender === "staff" ? "staff" : "system"),
      sender_name: msg.sender_name,
      document_url: msg.document_url,
    }));
    setMessages(adaptedMessages);

    setConversation((prev) => prev ? {
      ...prev,
      last_message: content.substring(0, 100),
      last_message_date: new Date().toISOString(),
    } : null);
  }, [conversation, user, selectedSubject, isSuperAdmin, selectedCity]);

  // 3. Rafraîchir les messages
  const refreshMessages = useCallback(async () => {
    if (!conversation || !user) return;

    setLoadingMessages(true);
    try {
      const updatedMessages = await getPlayerMessages(user.id, user.email, conversation.dossier_ref);
      const adaptedMessages: AdaptedMessage[] = updatedMessages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender: msg.sender === "player" ? "user" : (msg.sender === "staff" ? "staff" : "system"),
        sender_name: msg.sender_name,
        document_url: msg.document_url,
      }));
      setMessages(adaptedMessages);
    } catch (err) {
      console.error("Erreur rafraîchissement:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [conversation, user]);

  // ✅ Villes disponibles selon le pays sélectionné
  const availableCities = useMemo(() => {
    return CITIES_BY_COUNTRY[selectedCountry as keyof typeof CITIES_BY_COUNTRY] || [];
  }, [selectedCountry]);

  // ✅ Sélectionner Super Admin
  const handleSuperAdminToggle = () => {
    console.log("🔄 Bascule vers SUPER ADMIN");
    setIsSuperAdmin(true);
    setSelectedCity("MASTER");
  };

  // ✅ Sélectionner une ville (désactive Super Admin)
  const handleCitySelect = (city: string) => {
    console.log(`🔄 Sélection ville: ${city}`);
    setIsSuperAdmin(false);
    setSelectedCity(city);
  };

  // ✅ Obtenir le nom de la destination
  const getDestinationDisplay = () => {
    if (isSuperAdmin) return "SUPER ADMIN";
    return `${selectedCountry} - ${selectedCity}`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* En-tête de la page */}
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/espace-joueur"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4 text-red-600" />
              Retour
            </Link>
            <div className="w-px h-4 bg-zinc-900" />
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-red-600" />
              <h1 className="text-sm font-black uppercase tracking-widest text-white">
                MESSAGERIE
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[7px] text-green-500 uppercase tracking-wider">
              Chiffré
            </span>
          </div>
        </div>
        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">
          Tous vos échanges avec le staff VAGONDYS
        </p>
      </header>

      {error && (
        <div className="mb-6 bg-red-600/10 border border-red-600/30 rounded-xl p-4 text-center">
          <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
            ⚠️ {error}
          </p>
        </div>
      )}

      {!conversation && !error && (
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center">
          <Mail className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            Aucune conversation disponible
          </p>
          <p className="text-[8px] text-zinc-600 mt-2">
            Utilisez le formulaire de contact pour initier un échange
          </p>
          <Link
            href="/contact"
            className="inline-block mt-4 bg-red-600/20 border border-red-600/50 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-red-500 hover:bg-red-600/30 transition-colors"
          >
            Contacter le support
          </Link>
        </div>
      )}

      {conversation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ✅ COLONNE GAUCHE : Conversations + Destinataire + Objet */}
          <div className="lg:col-span-1 bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-900">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Mail className="w-3 h-3 text-red-600" />
                Conversations
              </h2>
            </div>
            <MessageList
              conversations={[conversation]}
              selectedConversation={conversation}
              onSelectConversation={() => {}}
              loading={false}
            />

            {/* ✅ DESTINATAIRE - Arborescence Pays → Ville */}
            <div className="p-4 border-t border-zinc-900">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-3 h-3 text-red-600" />
                <span className="text-[8px] font-black uppercase text-zinc-500">
                  DESTINATAIRE
                </span>
              </div>

              {/* ✅ Bouton Super Admin (par défaut) - RÔLE INTERNE */}
              <button
                onClick={handleSuperAdminToggle}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all mb-2 ${
                  isSuperAdmin
                    ? "bg-red-600/20 border border-red-600/50 text-red-500"
                    : "bg-black border border-zinc-800 text-zinc-400 hover:border-red-600/30"
                }`}
              >
                <UserCog className="w-3 h-3" />
                SUPER ADMIN
              </button>

              {/* Sélection du pays */}
              <div className="relative mb-2">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                <select
                  title="Sélectionner le pays"
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setSelectedCity(availableCities[0] || "MASTER");
                    setIsSuperAdmin(false);
                  }}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2 pl-8 pr-4 text-[9px] font-mono text-white focus:border-red-600 outline-none appearance-none cursor-pointer uppercase"
                >
                  {Object.keys(CITIES_BY_COUNTRY).map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              {/* Sélection de la ville */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                <select
                  title="Sélectionner la ville"
                  value={selectedCity}
                  onChange={(e) => handleCitySelect(e.target.value)}
                  disabled={isSuperAdmin}
                  className={`w-full bg-black border border-zinc-800 rounded-lg py-2 pl-8 pr-4 text-[9px] font-mono text-white focus:border-red-600 outline-none appearance-none cursor-pointer uppercase ${
                    isSuperAdmin ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* ✅ BARRE DE RECHERCHE */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Rechercher une conversation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2 pl-8 pr-4 text-[9px] text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-colors"
                />
              </div>

              {/* ✅ OBJET DU SIGNAL */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3 h-3 text-red-600" />
                  <span className="text-[8px] font-black uppercase text-zinc-500">
                    Objet du signal
                  </span>
                </div>
                <select
                  title="Sélectionner l'objet du signal"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-3 text-[9px] font-mono text-white focus:border-red-600 outline-none appearance-none cursor-pointer uppercase"
                >
                  {SUBJECTS.map(subject => (
                    <option key={subject.value} value={subject.value}>
                      {subject.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Indicateur de sélection */}
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <p className="text-[6px] text-zinc-700 uppercase tracking-wider text-center">
                  {isSuperAdmin 
                    ? "📨 Envoi vers SUPER ADMIN" 
                    : `📨 Envoi vers ${selectedCountry} - ${selectedCity}`}
                </p>
              </div>
            </div>
          </div>

          {/* ✅ COLONNE DROITE : Messages + saisie */}
          <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden flex flex-col min-h-[60vh]">
            <MessageThread
              conversation={conversation}
              messages={messages}
              loading={loadingMessages}
              onRefresh={refreshMessages}
            />

            {/* Zone de saisie */}
            <MessageInput
              dossierRef={conversation.dossier_ref}
              onSend={handleSendMessage}
              disabled={loadingMessages}
              placeholder={`Saisissez votre message pour ${getDestinationDisplay()} (Ctrl+Entrée pour envoyer)...`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
