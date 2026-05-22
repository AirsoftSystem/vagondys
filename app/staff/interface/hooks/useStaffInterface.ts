
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { fetchGitHubArchive } from "@/lib/supabase/client";
import { getStationConfig, createDynamicClient } from "@/lib/supabase/master"; 
import { SignalMessage, HistoryMessage, GitHubArchiveData } from "../types/interface";

export const dynamic = 'force-dynamic';

/**
 * HOOK PERSONNALISÉ : useStaffInterface
 * Centralise 100% de la logique métier, des appels API et de la gestion d'état.
 */
export function useStaffInterface() {
  // --- ÉTATS PRINCIPAUX ---
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [messages, setMessages] = useState<SignalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string>("NANTES"); // Ville par défaut
  const [view, setView] = useState<"pending" | "archived">("pending");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // --- ÉTATS DE LA MODALE & HISTORIQUE ---
  const [replyingTo, setReplyingTo] = useState<SignalMessage | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [documentLink, setDocumentLink] = useState("");
  const [historyMessages, setHistoryMessages] = useState<HistoryMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [linkedDossiers, setLinkedDossiers] = useState<string[]>([]);
  const [githubArchive, setGithubArchive] = useState<GitHubArchiveData | null>(null);

  // --- ÉTATS D'ACTION (UI FEEDBACK) ---
  const [isSending, setIsSending] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isMarkingRead, setIsMarkingRead] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState("");
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

  // ✅ Déterminer la ville à partir de l'email de l'agent
  const getCityFromEmail = (email: string): string => {
    const lowerEmail = email.toLowerCase();
    if (lowerEmail.includes("nantes")) return "NANTES";
    if (lowerEmail.includes("lyon")) return "LYON";
    if (lowerEmail.includes("paris")) return "PARIS";
    if (lowerEmail.includes("marseille")) return "MARSEILLE";
    if (lowerEmail.includes("bordeaux")) return "BORDEAUX";
    if (lowerEmail.includes("lille")) return "LILLE";
    if (lowerEmail.includes("toulouse")) return "TOULOUSE";
    if (lowerEmail.includes("madrid")) return "MADRID";
    return "NANTES"; // Défaut
  };

  // ✅ CORRECTION : Récupérer l'utilisateur connecté depuis le MASTER (auth centralisée)
  useEffect(() => {
    const checkUser = async () => {
      try {
        // ✅ Utiliser le client MASTER pour l'authentification (auth centralisée)
        const { createClient: createMasterClient } = await import('@supabase/supabase-js');
        
        const masterClient = createMasterClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MASTER!
        );

        const { data: { user } } = await masterClient.auth.getUser();
        
        if (user?.email) {
          setUserEmail(user.email);
          console.log("👤 Utilisateur connecté (MASTER):", user.email);
        } else {
          console.log("⚠️ Aucun utilisateur connecté dans MASTER");
        }
      } catch (err) {
        console.error("❌ Erreur récupération utilisateur:", err);
      }
    };
    
    checkUser();
  }, []);

  // ✅ CORRECTION : Initialisation du client dynamique avec SERVICE_ROLE pour la lecture
  useEffect(() => {
    const initClient = async () => {
      if (userEmail) {
        const city = getCityFromEmail(userEmail);
        setUserCity(city);
        try {
          // ✅ Récupérer la configuration de la station
          const config = await getStationConfig(city, 'FR');
          if (!config) {
            console.error(`❌ Configuration introuvable pour ${city}`);
            return;
          }
          
          // ✅ CORRECTION : Utiliser createDynamicClient avec SERVICE_ROLE
          // pour bypasser les RLS et lire toutes les données
          const client = await createDynamicClient(city, 'FR', 'STAFF');
          
          setSupabase(client);
          console.log(`✅ Client STAFF créé pour ${city} avec SERVICE_ROLE`);
          
        } catch (err) {
          console.error("❌ Erreur création client dynamique:", err);
        }
      }
    };
    initClient();
  }, [userEmail]);

  // --- LOGIQUE DE REGROUPEMENT (DOUBLONS) ---
  const groupedMessages = useMemo(() => {
    const groups: Record<string, SignalMessage> = {};
    messages.forEach((msg) => {
      const key = msg.dossier_ref || msg.payload.email;
      if (!groups[key] || new Date(msg.created_at) > new Date(groups[key].created_at)) {
        groups[key] = msg;
      }
    });
    return Object.values(groups).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [messages]);

  // --- FONCTIONS DE CHARGEMENT ---
  // ✅ Correction: fetchMessages supprimé car non utilisé
  // Le chargement se fait directement dans l'useEffect qui dépend de supabase, view et userEmail

  const fetchHistoryAndLinks = useCallback(async (ref: string, email: string) => {
    if (!ref || !supabase) return;
    setLoadingHistory(true);
    setGithubArchive(null);
    
    try {
      const { data: historyData } = await supabase
        .from('communication_replies')
        .select('*')
        .eq('dossier_ref', ref)
        .order('created_at', { ascending: true });

      const { data: clientMessages } = await supabase
        .from('pending_signals')
        .select('*')
        .eq('dossier_ref', ref)
        .order('created_at', { ascending: true });

      const archivedData = await fetchGitHubArchive(ref);    
      
      const clientHistory: HistoryMessage[] = (clientMessages || []).map((m: SignalMessage) => ({
          id: m.id,
          created_at: m.created_at,
          agent_email: "CLIENT",
          content: m.payload.message,
          dossier_ref: m.dossier_ref || "",
          document_url: null
      }));

      let combinedHistory: HistoryMessage[] = [
          ...clientHistory,
          ...(historyData || []).map((h: HistoryMessage) => ({ ...h, document_url: h.document_url || null }))
      ];

      if (archivedData && archivedData.echanges_staff) {
          setGithubArchive(archivedData);
          const archivedHistory: HistoryMessage[] = archivedData.echanges_staff.map((h: HistoryMessage) => ({
              ...h,
              document_url: h.document_url || null
          }));
          combinedHistory = [...archivedHistory, ...combinedHistory];
      }

      const uniqueHistory = Array.from(new Map(combinedHistory.map(item => [item.id, item])).values());
      uniqueHistory.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const { data: linkedData } = await supabase
        .from('pending_signals')
        .select('dossier_ref')
        .eq('payload->>email', email.toLowerCase())
        .neq('dossier_ref', ref);

      setHistoryMessages(uniqueHistory);
      setLinkedDossiers(Array.from(new Set(linkedData?.map((d: { dossier_ref: string }) => d.dossier_ref).filter(Boolean))) as string[]);
    } catch (err) {
      console.error("Erreur historique:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [supabase]);

  // --- ACTIONS ---
  const handleExternalSearch = async () => {
    if (!searchRef.trim()) return;
    setIsSearchingExternal(true);
    setGithubArchive(null);    
    try {
      const archivedData = await fetchGitHubArchive(searchRef.trim().toUpperCase());   
      if (archivedData) {
        const mockMsg: SignalMessage = {
          ...archivedData.dossier,
          id: `archived-${archivedData.dossier.dossier_ref}`
        };      
        setHistoryMessages((archivedData.echanges_staff || []).map((h: HistoryMessage) => ({ ...h, document_url: h.document_url || null })));
        setGithubArchive(archivedData);
        setReplyingTo(mockMsg);
      } else {
        alert("Aucune archive trouvée.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const handleMarkAsReadSilent = async (msg: SignalMessage) => {
    if (isMarkingRead || !userEmail || !supabase) return;
    const secureRef = msg.dossier_ref ? String(msg.dossier_ref).trim().toUpperCase() : null;
    if (!secureRef) return alert("Erreur : Référence manquante.");

    setIsMarkingRead(msg.id);    
    try {
      const response = await fetch('/api/notify-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierRef: secureRef, email: msg.payload.email, cityCode: userCity }),
      });
      if (!response.ok) throw new Error("Erreur mise à jour");
      setMessages(prev => prev.filter(m => (m.dossier_ref || m.payload.email) !== (msg.dossier_ref || msg.payload.email)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsMarkingRead(null);
    }
  };

  const handleDeepArchive = async (msg: SignalMessage) => {
    if (!confirm(`Confirmer la sécurisation GitHub et purge définitive pour ${msg.dossier_ref} ?`)) return;    
    setIsArchiving(msg.id);
    try {
      const response = await fetch('/api/archive-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: historyMessages, purgeActive: true, city_code: userCity }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMessages(prev => prev.filter(m => (m.dossier_ref !== msg.dossier_ref)));
        setReplyingTo(null);
        alert("Dossier sécurisé avec succès.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsArchiving(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTo || !replyContent || !userEmail || !supabase) return;
    setIsSending(true);    
    try {
      const fullEmailContent = `${replyContent}\n\n---\nPour répondre : https://vagondys.com/contact?ref=${replyingTo.dossier_ref}`;
      const response = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: self.crypto.randomUUID(),
          messageId: replyingTo.id,
          to: replyingTo.payload.email,
          subject: replyingTo.payload.subject,
          message: fullEmailContent, 
          dbContent: replyContent, 
          agentEmail: userEmail,
          docLink: documentLink,
          dossierRef: replyingTo.dossier_ref,
          cityCode: userCity,
          silent: false 
        }),
      });

      if (response.ok) {
        setReplyContent("");
        setDocumentLink("");
        setReplyingTo(null);        
        if(view === "pending") {
            setMessages(prev => prev.filter(m => (m.dossier_ref || m.payload.email) !== (replyingTo.dossier_ref || replyingTo.payload.email)));
        }        
        alert("Réponse transmise.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const toggleExpand = (msgId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(msgId)) newExpanded.delete(msgId);
    else newExpanded.add(msgId);
    setExpandedMessages(newExpanded);
  };

  // Chargement initial des messages (remplace l'appel à fetchMessages)
  useEffect(() => {
    if (!supabase || !userEmail) return;
    
    const loadMessages = async () => {
      setLoading(true);
      console.log(`🔍 Chargement des messages pour ${userEmail}, vue: ${view}`);
      
      try {
        let query = supabase
          .from("pending_signals")
          .select("*")
          .order("created_at", { ascending: false });

        // Filtrer par statut de lecture
        query = view === "pending" ? query.eq("is_read", false) : query.eq("is_read", true);
        
        // AJOUT : Forcer confirmed = true (optionnel selon ta logique)
        query = query.eq("confirmed", true);

        // Filtres par mots-clés selon l'email de l'agent (Admin vs Spécialisé)
        const admins = ["contact@vagondys.com", "vagondys@gmail.com", "admin@vagondys.com"];
        if (!admins.includes(userEmail.toLowerCase())) {
          const lowerEmail = userEmail.toLowerCase();
          let keyword = "";
          if (lowerEmail.includes("communication")) keyword = "communication";
          else if (lowerEmail.includes("sponsors")) keyword = "sponsor";
          else if (lowerEmail.includes("ligue")) keyword = "ligue";
          else if (lowerEmail.includes("competition")) keyword = "competition";
          else if (lowerEmail.includes("tournois")) keyword = "tournoi";
          else if (lowerEmail.includes("player")) keyword = "player";
          else if (lowerEmail.includes("licence")) keyword = "licence";
          else if (lowerEmail.includes("reservations")) keyword = "reservation";
          else if (lowerEmail.includes("nantes")) keyword = "nantes";

          if (keyword) {
            query = query.or(`payload->>subject.ilike.%${keyword}%,payload->>message.ilike.%${keyword}%`);
          }
        }

        console.log("📝 Requête SQL construite");
        const { data, error } = await query;
        
        if (error) {
          console.error("❌ Erreur requête:", error);
          throw error;
        }
        
        console.log(`📦 Données reçues: ${data?.length || 0} messages`);
        if (data?.length > 0) {
          console.log("📋 Premier message:", {
            id: data[0].id,
            dossier_ref: data[0].dossier_ref,
            is_read: data[0].is_read,
            confirmed: data[0].confirmed,
            subject: data[0].payload?.subject
          });
        }
        
        setMessages(data || []);
      } catch (err) {
        console.error("❌ Erreur chargement messages:", err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [supabase, userEmail, view]);

  // --- TEMPS RÉEL ---
  // ✅ CORRECTION TEMPORAIRE : Désactivation du Realtime WebSocket
  // Le WebSocket cause une erreur "message channel closed" qui bloque le chargement initial.
  // À réactiver après avoir validé que les messages s'affichent correctement.
  /*
  useEffect(() => {
    if (!userEmail || !supabase) return;
    const channel = supabase
      .channel('realtime_staff_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_signals' }, () => {
          // Recharger les messages
          if (supabase && userEmail) {
            const reloadMessages = async () => {
              // Le rechargement est délégué à l'effet principal
            };
            reloadMessages();
          }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userEmail]);
  */

  return {
    groupedMessages, loading, userEmail, view, setView,
    expandedMessages, toggleExpand,
    replyingTo, setReplyingTo,
    replyContent, setReplyContent,
    documentLink, setDocumentLink,
    historyMessages, loadingHistory,
    linkedDossiers, githubArchive,
    isSending, isArchiving, isMarkingRead,
    searchRef, setSearchRef, isSearchingExternal,
    handleExternalSearch, handleMarkAsReadSilent,
    handleDeepArchive, handleSendReply, fetchHistoryAndLinks
  };
}
