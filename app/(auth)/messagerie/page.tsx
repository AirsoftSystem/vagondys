
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { 
  Home, 
  Mail, 
  RefreshCcw, 
  ShieldCheck,
  Search,
  MapPin,
  Globe,
  UserCog,
  MessageSquare
} from "lucide-react";
import { createVagondysClient } from "@/lib/supabase/client";
import {
  getUserConversations,
  getConversationMessages,
  sendMessage,
  type Conversation,
  type Message,
} from "./actions";
import MessageInput from "./components/MessageInput";
import MessageThread from "./components/MessageThread";
import MessageList from "./components/MessageList";

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

export default function MessageriePage() {
  const router = useRouter();
  const supabase = createVagondysClient();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // ✅ NOUVEAUX ÉTATS POUR LA REFONTE
  const [selectedCountry, setSelectedCountry] = useState<string>("FRANCE");
  const [selectedCity, setSelectedCity] = useState<string>("MASTER");
  const [selectedSubject, setSelectedSubject] = useState<string>("COMMUNICATION");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(true);

  // 1. Vérifier l'authentification et charger les conversations
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !currentUser) {
          router.push("/connexion");
          return;
        }
        
        setUser(currentUser);
        
        if (currentUser.email) {
          const userConversations = await getUserConversations(currentUser.email);
          setConversations(userConversations);
        }
      } catch (err) {
        console.error("Erreur auth:", err);
        setError("Erreur d'authentification");
        router.push("/connexion");
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [supabase, router]);

  // 2. Charger les messages
  const loadMessages = async (conversation: Conversation) => {
    if (!user?.email) return;
    
    setSelectedConversation(conversation);
    setLoadingMessages(true);
    setMessages([]);
    setError(null);
    
    try {
      const conversationMessages = await getConversationMessages(
        conversation.dossier_ref,
        user.email
      );
      
      setMessages(conversationMessages);
      
      if (conversation.unread_count > 0) {
        setConversations(prev =>
          prev.map(c =>
            c.dossier_ref === conversation.dossier_ref ? { ...c, unread_count: 0 } : c
          )
        );
      }
    } catch (err) {
      console.error("Erreur chargement messages:", err);
      setError("Impossible de charger les messages.");
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Envoyer un nouveau message AVEC ville et objet
  const handleSendMessage = async (content: string, fileUrl?: string, fileKey?: string) => {
    if (!user) {
      throw new Error("Utilisateur non authentifié");
    }
    
    // ✅ CORRECTION : 'let' → 'const' (jamais réassigné)
    const targetCity = isSuperAdmin ? "MASTER" : selectedCity;
    
    const result = await sendMessage({
      dossierRef: selectedConversation?.dossier_ref || `VGD-${Date.now()}`,
      content: content,
      userId: user.id,
      userEmail: user.email!,
      fileUrl: fileUrl,
      fileKey: fileKey,
      targetCity: targetCity,
      subject: selectedSubject,
    });
    
    if (!result.success) {
      throw new Error(result.error || "Erreur d'envoi");
    }
    
    // Recharger les messages
    if (selectedConversation) {
      const updatedMessages = await getConversationMessages(
        selectedConversation.dossier_ref,
        user.email!
      );
      setMessages(updatedMessages);
    }
  };

  const refreshMessages = async () => {
    if (selectedConversation && user?.email) {
      setLoadingMessages(true);
      try {
        const updatedMessages = await getConversationMessages(
          selectedConversation.dossier_ref,
          user.email
        );
        setMessages(updatedMessages);
      } catch (err) {
        console.error("Erreur rafraîchissement:", err);
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  // ✅ Villes disponibles selon le pays sélectionné
  const availableCities = useMemo(() => {
    return CITIES_BY_COUNTRY[selectedCountry as keyof typeof CITIES_BY_COUNTRY] || [];
  }, [selectedCountry]);

  // ✅ Filtrer les conversations par recherche
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase().trim();
    return conversations.filter(conv =>
      conv.participant_name.toLowerCase().includes(term) ||
      conv.participant_email.toLowerCase().includes(term) ||
      conv.dossier_ref.toLowerCase().includes(term) ||
      conv.last_message.toLowerCase().includes(term)
    );
  }, [conversations, searchTerm]);

  // ✅ Sélectionner Super Admin
  const handleSuperAdminToggle = () => {
    setIsSuperAdmin(true);
    setSelectedCity("MASTER");
  };

  // ✅ Sélectionner une ville
  const handleCitySelect = (city: string) => {
    setIsSuperAdmin(false);
    setSelectedCity(city);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white font-sans">
      {/* Navigation haute */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <Home className="w-4 h-4 text-red-600" />
            Accueil
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-red-600" />
            <span className="text-[9px] font-black uppercase text-zinc-400">
              Messagerie sécurisée
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-20 pb-12">
        
        {/* En-tête */}
        <header className="mb-8 text-center">
          <div className="inline-block px-4 py-1 border border-red-600 text-red-600 text-[10px] font-black uppercase tracking-[0.5em] mb-6">
            Communication Officielle
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-3">
            MESSAGERIE
          </h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest max-w-xl mx-auto">
            Tous vos échanges avec le staff et les services officiels
          </p>
        </header>

        {error && (
          <div className="mb-6 bg-red-600/10 border border-red-600/30 rounded-xl p-4 text-center">
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
              ⚠️ {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ✅ COLONNE GAUCHE : Conversations + Destinataire + Objet */}
          <div className="lg:col-span-1 bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
            
            {/* Conversations */}
            <div className="p-4 border-b border-zinc-900">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Mail className="w-3 h-3 text-red-600" />
                Conversations ({filteredConversations.length})
              </h2>
            </div>
            <MessageList
              conversations={filteredConversations}
              selectedConversation={selectedConversation}
              onSelectConversation={loadMessages}
              loading={loading}
            />

            {/* ✅ DESTINATAIRE - Arborescence Pays → Ville */}
            <div className="p-4 border-t border-zinc-900">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-3 h-3 text-red-600" />
                <span className="text-[8px] font-black uppercase text-zinc-500">
                  DESTINATAIRE
                </span>
              </div>

              {/* Bouton Super Admin (par défaut) */}
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

              {/* ✅ CORRECTION : Ajout de title pour l'accessibilité (axe/forms) */}
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

              {/* ✅ CORRECTION : Ajout de title pour l'accessibilité (axe/forms) */}
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
                {/* ✅ CORRECTION : Ajout de title pour l'accessibilité (axe/forms) */}
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

              {/* Indicateur de sélection */}
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
              conversation={selectedConversation}
              messages={messages}
              loading={loadingMessages}
              onRefresh={refreshMessages}
            />

            {/* Zone de saisie avec dossier_ref dynamique */}
            <MessageInput
              dossierRef={selectedConversation?.dossier_ref || null}
              onSend={handleSendMessage}
              disabled={loadingMessages}
              placeholder="Saisissez votre message (Ctrl+Entrée pour envoyer)..."
            />
          </div>
        </div>
      </div>
    </main>
  );
}
