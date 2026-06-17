
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { 
  Home, 
  Mail, 
  RefreshCcw, 
  ShieldCheck
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

  // ✅ FONCTION : Vérifier la première connexion (déclarée AVANT le useEffect)
  const checkFirstLogin = useCallback(async () => {
    try {
      const response = await fetch("/api/messagerie/check-first-login");
      const data = await response.json();
      
      if (data.success && data.welcome_sent) {
        console.log("✅ Message de bienvenue envoyé lors de la première connexion");
        
        // ✅ Recharger les conversations pour afficher le nouveau message
        if (user?.email) {
          const updatedConversations = await getUserConversations(user.email);
          setConversations(updatedConversations);
          
          // Si une conversation est sélectionnée, recharger ses messages
          if (selectedConversation) {
            const updatedMessages = await getConversationMessages(
              selectedConversation.dossier_ref,
              user.email
            );
            setMessages(updatedMessages);
          }
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
  }, [user, selectedConversation]);

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
        
        // Charger les conversations réelles
        if (currentUser.email) {
          const userConversations = await getUserConversations(currentUser.email);
          setConversations(userConversations);
        }
        
        // ✅ AJOUT : Vérifier si c'est la première connexion pour créer le message de bienvenue
        await checkFirstLogin();
        
      } catch (err) {
        console.error("Erreur auth:", err);
        setError("Erreur d'authentification");
        router.push("/connexion");
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [supabase, router, checkFirstLogin]); // ✅ AJOUT de checkFirstLogin dans les dépendances

  // 2. Charger les messages quand une conversation est sélectionnée
  // ✅ CORRECTION : utiliser dossier_ref au lieu de id
  const loadMessages = async (conversation: Conversation) => {
    if (!user?.email) return;
    
    setSelectedConversation(conversation);
    setLoadingMessages(true);
    setMessages([]);
    setError(null);
    
    try {
      const conversationMessages = await getConversationMessages(
        conversation.dossier_ref, // ✅ dossier_ref au lieu de id
        user.email
      );
      
      setMessages(conversationMessages);
      
      // ✅ Mise à jour du compteur local (unread_count toujours 0 maintenant)
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

  // 3. Envoyer un nouveau message
  // ✅ CORRECTION : utiliser dossier_ref au lieu de id
  const handleSendMessage = async (content: string, fileUrl?: string, fileKey?: string) => {
    if (!selectedConversation || !user) {
      throw new Error("Conversation non sélectionnée");
    }
    
    const result = await sendMessage({
      dossierRef: selectedConversation.dossier_ref, // ✅ dossier_ref au lieu de conversationId
      content: content,
      userId: user.id,
      userEmail: user.email!,
      fileUrl: fileUrl,
      fileKey: fileKey,
    });
    
    if (!result.success) {
      throw new Error(result.error || "Erreur d'envoi");
    }
    
    // Recharger les messages pour voir le nouveau
    const updatedMessages = await getConversationMessages(
      selectedConversation.dossier_ref, // ✅ dossier_ref au lieu de id
      user.email!
    );
    setMessages(updatedMessages);
    
    // Mettre à jour la dernière ligne de la conversation dans la liste
    setConversations(prev =>
      prev.map(c =>
        c.dossier_ref === selectedConversation.dossier_ref
          ? {
              ...c,
              last_message: content.substring(0, 100),
              last_message_date: new Date().toISOString(),
            }
          : c
      )
    );
  };

  // Rafraîchir les messages
  // ✅ CORRECTION : utiliser dossier_ref au lieu de id
  const refreshMessages = async () => {
    if (selectedConversation && user?.email) {
      setLoadingMessages(true);
      try {
        const updatedMessages = await getConversationMessages(
          selectedConversation.dossier_ref, // ✅ dossier_ref au lieu de id
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
          
          {/* Colonne gauche : Liste des conversations */}
          <div className="lg:col-span-1 bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-900">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Mail className="w-3 h-3 text-red-600" />
                Conversations ({conversations.length})
              </h2>
            </div>
            <MessageList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={loadMessages}
              loading={loading}
            />
          </div>

          {/* Colonne droite : Messages + saisie */}
          <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden flex flex-col min-h-[60vh]">
            {/* Fil de discussion */}
            <MessageThread
              conversation={selectedConversation}
              messages={messages}
              loading={loadingMessages}
              onRefresh={refreshMessages}
            />

            {/* Zone de saisie (uniquement si une conversation est sélectionnée) */}
            {selectedConversation && (
              <MessageInput
                dossierRef={selectedConversation.dossier_ref} // ✅ dossier_ref au lieu de id
                onSend={handleSendMessage}
                disabled={loadingMessages}
                placeholder="Saisissez votre réponse..."
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
