
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCcw, ShieldCheck, MessageSquare, ArrowLeft, MapPin, Globe } from "lucide-react";
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

// ✅ Liste des villes disponibles pour l'envoi
const AVAILABLE_CITIES = [
  { code: "NANTES", name: "NANTES", country: "FR" },
  { code: "LYON", name: "LYON", country: "FR" },
  { code: "PARIS", name: "PARIS", country: "FR" },
  { code: "MARSEILLE", name: "MARSEILLE", country: "FR" },
  { code: "BORDEAUX", name: "BORDEAUX", country: "FR" },
  { code: "LILLE", name: "LILLE", country: "FR" },
  { code: "TOULOUSE", name: "TOULOUSE", country: "FR" },
  { code: "MADRID", name: "MADRID", country: "ES" },
  { code: "MASTER", name: "ADMINISTRATION CENTRALE", country: "FR" },
];

/**
 * Page Messagerie pour l'espace joueur
 * Utilise les mêmes composants que la messagerie des demandeurs
 * mais avec des actions spécifiques lisant depuis l'archive GitHub
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
  
  // ✅ État pour la ville cible (destinataire)
  const [targetCity, setTargetCity] = useState<string>("MASTER");
  const [showCitySelector, setShowCitySelector] = useState(false);

  // ✅ FONCTION : Vérifier la première connexion (mémorisée avec useCallback)
  const checkFirstLogin = useCallback(async () => {
    try {
      const response = await fetch("/api/messagerie/check-first-login");
      const data = await response.json();
      
      if (data.success && data.welcome_sent) {
        console.log("✅ Message de bienvenue envoyé lors de la première connexion");
        
        // ✅ Recharger les messages pour afficher le message de bienvenue
        if (conversation && user) {
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
        }
      } else if (data.success && !data.welcome_sent) {
        console.log("ℹ️ Message de bienvenue non encore envoyé (compte non actif ou déjà envoyé)");
      } else {
        console.warn("⚠️ check-first-login: réponse inattendue", data);
      }
    } catch (err) {
      console.error("❌ Erreur check-first-login:", err);
      // Non bloquant - l'utilisateur peut toujours utiliser la messagerie
    }
  }, [conversation, user]);

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

        // Charger la conversation du joueur
        const playerConv = await getPlayerConversation(userId, userEmail);

        if (!playerConv) {
          setError("Impossible de charger votre messagerie. Contactez le support.");
          setLoading(false);
          return;
        }

        // Adapter pour les composants existants
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

        // Charger les messages
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

        // ✅ AJOUT : Vérifier si c'est la première connexion pour créer le message de bienvenue
        await checkFirstLogin();

      } catch (err) {
        console.error("Erreur chargement messagerie:", err);
        setError("Erreur lors du chargement de la messagerie");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [supabase, router, checkFirstLogin]); // ✅ AJOUT de checkFirstLogin dans les dépendances

  // 2. Envoyer un nouveau message vers la ville sélectionnée
  const handleSendMessage = useCallback(async (content: string, fileUrl?: string, fileKey?: string) => {
    if (!conversation || !user) {
      throw new Error("Conversation non disponible");
    }

    // ✅ Appeler sendPlayerMessage avec la ville cible
    const result = await sendPlayerMessage({
      dossierRef: conversation.dossier_ref,
      content: content,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      targetCity: targetCity, // ✅ Ajout de la ville cible
      fileUrl: fileUrl,
      fileKey: fileKey,
    });

    if (!result.success) {
      throw new Error(result.error || "Erreur d'envoi");
    }

    // Recharger les messages
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

    // Mettre à jour le dernier message dans la conversation
    setConversation((prev) => prev ? {
      ...prev,
      last_message: content.substring(0, 100),
      last_message_date: new Date().toISOString(),
    } : null);
  }, [conversation, user, targetCity]);

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

  // ✅ Obtenir le nom de la ville sélectionnée
  const getSelectedCityName = () => {
    const city = AVAILABLE_CITIES.find(c => c.code === targetCity);
    return city?.name || "ADMINISTRATION CENTRALE";
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
          {/* Colonne gauche : Liste des conversations + sélecteur de ville */}
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

            {/* ✅ Sélecteur de ville destinataire */}
            <div className="p-4 border-t border-zinc-900 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3 h-3 text-red-600" />
                <span className="text-[8px] font-black uppercase text-zinc-500">
                  DESTINATAIRE
                </span>
              </div>
              
              <button
                onClick={() => setShowCitySelector(!showCitySelector)}
                className="w-full flex items-center justify-between bg-black border border-zinc-800 rounded-lg px-3 py-2 hover:border-red-600/50 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3 h-3 text-zinc-500" />
                  <span className="text-[9px] font-mono text-white uppercase">
                    {getSelectedCityName()}
                  </span>
                </div>
                <span className="text-[8px] text-zinc-600">▼</span>
              </button>

              {showCitySelector && (
                <div className="mt-2 bg-black border border-zinc-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  {AVAILABLE_CITIES.map((city) => (
                    <button
                      key={city.code}
                      onClick={() => {
                        setTargetCity(city.code);
                        setShowCitySelector(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[9px] font-mono uppercase transition-colors ${
                        targetCity === city.code
                          ? "bg-red-600/20 text-red-500 border-l-2 border-red-600"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {city.name} {city.country !== "FR" && `(${city.country})`}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[6px] text-zinc-700 uppercase tracking-wider mt-2 text-center">
                Sélectionnez la ville du destinataire
              </p>
            </div>
          </div>

          {/* Colonne droite : Messages + saisie */}
          <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden flex flex-col min-h-[60vh]">
            {/* Fil de discussion */}
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
              placeholder={`Saisissez votre message pour ${getSelectedCityName()} (Ctrl+Entrée pour envoyer)...`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
