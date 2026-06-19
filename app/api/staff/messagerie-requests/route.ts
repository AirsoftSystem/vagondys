
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * API de récupération des conversations de la messagerie privée
 * GET /api/staff/messagerie-requests
 * 
 * Sécurité : Réservé au staff (email @vagondys.com ou dans staff_registry)
 * 
 * ✅ CORRECTION : Affiche les demandes EN ATTENTE + comptes avec messages
 * ✅ CORRECTION : Exclusion du compte admin (VGD-ADMIN001)
 * ✅ AJOUT : Récupération des JOUEURS (athlètes) en plus des PARTENAIRES
 * ✅ AJOUT : Dernier message de chaque conversation
 * ✅ AJOUT : Détermination automatique du type (sponsor, client, fournisseur, etc.)
 * ✅ AJOUT : Tri alphabétique des résultats
 * ✅ AJOUT : Champ has_unread pour identifier les conversations avec messages non lus
 * ✅ AJOUT : Utilisation du request_type du payload pour les demandes en attente
 * 
 * ✅ CORRECTION 2026-06-18 : Ajout de .not("dossier_ref", "is", null) pour éviter les erreurs
 * ✅ CORRECTION 2026-06-18 : Utilisation directe du champ "type" de la table pour les demandes en attente
 * ✅ CORRECTION 2026-06-18 : Priorité au type stocké en base plutôt qu'au fallback par mots-clés
 * ✅ CORRECTION 2026-06-18 : Utilisation du champ "role" de messagerie_accounts pour les partenaires
 * ✅ CORRECTION 2026-06-24 : Inclusion des messages système (system@vagondys.com) dans les messages non lus
 * ✅ CORRECTION 2026-06-24 : Exclusion des messages du SUPER ADMIN (vagondys@gmail.com) pour tous sauf le SUPER ADMIN
 */
export async function GET() {
  try {
    // 1. Vérification des variables d’environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    // 2. Récupérer l’utilisateur authentifié (via cookie de session)
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // 3. Vérifier que l’utilisateur est staff
    const userEmail = user.email?.toLowerCase() || "";
    const isStaffEmail = userEmail.endsWith("@vagondys.com");

    let isStaff = isStaffEmail;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (!isStaff) {
      // Vérification supplémentaire dans staff_registry
      const { data: staffRecord } = await supabaseAdmin
        .from("staff_registry")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();

      isStaff = !!staffRecord;
    }

    if (!isStaff) {
      return NextResponse.json(
        { error: "Accès réservé au staff" },
        { status: 403 }
      );
    }

    // ✅ SUPER ADMIN = vagondys@gmail.com UNIQUEMENT
    const isSuperAdmin = userEmail === "vagondys@gmail.com";
    console.log(`🔍 [messagerie-requests] userEmail=${userEmail}, isSuperAdmin=${isSuperAdmin}`);

    // ✅ 4. Récupérer les demandes EN ATTENTE (pending_messagerie_requests)
    const { data: pendingRequests, error: fetchPendingError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (fetchPendingError) {
      console.error("Erreur récupération demandes en attente:", fetchPendingError);
      // Non bloquant - on continue
    }

    // ✅ 5. Récupérer les comptes PARTENAIRES avec messages (messagerie_accounts)
    const { data: partnerAccounts, error: fetchPartnerError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("*")
      .not("dossier_ref", "is", null)
      .neq("dossier_ref", "VGD-ADMIN001")
      .order("created_at", { ascending: false });

    if (fetchPartnerError) {
      console.error("Erreur récupération comptes partenaires:", fetchPartnerError);
      // Non bloquant - on continue
    }

    // ✅ 6. Récupérer les JOUEURS (athlètes) avec un dossier_ref
    const { data: players, error: fetchPlayersError } = await supabaseAdmin
      .from("athletes")
      .select("id, full_name, email, phone, dossier_ref, city, country, created_at, status")
      .not("dossier_ref", "is", null)
      .order("created_at", { ascending: false });

    if (fetchPlayersError) {
      console.error("Erreur récupération joueurs:", fetchPlayersError);
      // Non bloquant - on continue
    }

    // ✅ 7. Récupérer les dossier_ref des partenaires (pour vérifier s'ils ont des messages)
    const partnerDossierRefs: string[] = [];
    if (partnerAccounts) {
      for (const account of partnerAccounts) {
        if (account.dossier_ref) {
          partnerDossierRefs.push(account.dossier_ref);
        }
      }
    }

    // ✅ 8. Récupérer les dossier_ref des joueurs
    const playerDossierRefs: string[] = [];
    if (players) {
      for (const player of players) {
        if (player.dossier_ref) {
          playerDossierRefs.push(player.dossier_ref);
        }
      }
    }

    // ✅ 9. Récupérer TOUS les messages pour vérifier quels dossiers ont des messages
    const allDossierRefs = [...partnerDossierRefs, ...playerDossierRefs];
    let lastMessagesMap = new Map<string, { content: string; created_at: string; sender_name: string }>();
    const dossierWithMessages = new Set<string>();

    // ✅ 9bis. Récupérer les messages non lus par dossier
    const unreadDossierMap = new Map<string, boolean>();

    // ✅ CORRECTION : Récupérer les messages depuis Supabase ET depuis GitHub
    // 1. D'abord depuis Supabase
    if (allDossierRefs.length > 0) {
      // ✅ CORRECTION : Inclure les messages système (system@vagondys.com) pour activer has_unread
      // Exclusion uniquement des messages du Super Admin (vagondys@gmail.com)
      let query = supabaseAdmin
        .from("messagerie_messages")
        .select("dossier_ref, content, created_at, sender_name, is_read, sender_email")
        .in("dossier_ref", allDossierRefs);
      
      // Si ce n'est pas le SUPER ADMIN, exclure uniquement les messages du Super Admin
      if (!isSuperAdmin) {
        query = query.neq("sender_email", "vagondys@gmail.com");
      }
      
      const { data: allMessages, error: messagesError } = await query.order("created_at", { ascending: false });

      if (messagesError) {
        console.error("Erreur récupération messages Supabase:", messagesError);
      } else if (allMessages && allMessages.length > 0) {
        type RawMessage = {
          dossier_ref: string;
          content: string;
          created_at: string;
          sender_name: string;
          is_read: boolean;
          sender_email: string;
        };
        
        const typedMessages = allMessages as RawMessage[];
        
        for (const msg of typedMessages) {
          dossierWithMessages.add(msg.dossier_ref);
          
          // ✅ CORRECTION : Messages non lus - inclure les messages système (system@vagondys.com)
          // Exclusion uniquement du Super Admin (vagondys@gmail.com)
          const isSuperAdminMessage = msg.sender_email === "vagondys@gmail.com";
          
          if (msg.is_read === false && 
              !msg.sender_email.endsWith("@vagondys.com") &&
              (!isSuperAdminMessage || isSuperAdmin)) {
            unreadDossierMap.set(msg.dossier_ref, true);
          }
        }
        
        const tempMap = new Map<string, { content: string; created_at: string; sender_name: string }>();
        for (const msg of typedMessages) {
          if (!tempMap.has(msg.dossier_ref)) {
            tempMap.set(msg.dossier_ref, {
              content: msg.content,
              created_at: msg.created_at,
              sender_name: msg.sender_name
            });
          }
        }
        lastMessagesMap = tempMap;
      }

      // ✅ 2. CORRECTION : Pour les dossiers qui n'ont PAS de messages dans Supabase,
      // vérifier dans GitHub via l'API d'archive
      const missingDossierRefs = allDossierRefs.filter(ref => !dossierWithMessages.has(ref));
      
      if (missingDossierRefs.length > 0) {
        console.log(`🔍 Vérification de ${missingDossierRefs.length} dossiers dans GitHub`);
        
        const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
        
        for (const ref of missingDossierRefs) {
          try {
            // Appeler l'API d'archive pour récupérer les messages du dossier
            const archiveRes = await fetch(`${frontendUrl}/api/archive-external?ref=${encodeURIComponent(ref)}`);
            
            if (archiveRes.ok) {
              const archiveData = await archiveRes.json();
              
              // Vérifier si l'archive contient des messages (fil_de_discussion)
              if (archiveData && archiveData.fil_de_discussion && archiveData.fil_de_discussion.length > 0) {
                const threadMessages = archiveData.fil_de_discussion;
                
                // Ajouter le dossier comme ayant des messages
                dossierWithMessages.add(ref);
                
                // Récupérer le dernier message
                const lastMsg = threadMessages[threadMessages.length - 1];
                if (lastMsg && lastMsg.content) {
                  // ✅ CORRECTION : Si ce n'est pas le SUPER ADMIN, ne pas afficher les messages système
                  const isSystemMessage = lastMsg.sender === "SYSTEM" || lastMsg.sender_name?.includes("Système");
                  const isSuperAdminMessage = lastMsg.sender === "vagondys@gmail.com" || lastMsg.sender_email === "vagondys@gmail.com";
                  if ((!isSystemMessage || isSuperAdmin) && (!isSuperAdminMessage || isSuperAdmin)) {
                    lastMessagesMap.set(ref, {
                      content: lastMsg.content.substring(0, 100),
                      created_at: lastMsg.created_at || new Date().toISOString(),
                      sender_name: lastMsg.sender_name || lastMsg.sender || "Système"
                    });
                  }
                }
                
                // Vérifier s'il y a des messages non lus (pour l'alerte)
                // ✅ CORRECTION : Si ce n'est pas le SUPER ADMIN, ne pas compter les messages système
                const hasSystemMessage = threadMessages.some((msg: { sender?: string; sender_name?: string; sender_email?: string }) => 
                  msg.sender === "SYSTEM" || 
                  msg.sender_name === "Système VAGONDYS" || 
                  msg.sender_name?.includes("Système") ||
                  msg.sender === "vagondys@gmail.com" ||
                  msg.sender_email === "vagondys@gmail.com"
                );
                
                if (hasSystemMessage && isSuperAdmin) {
                  unreadDossierMap.set(ref, true);
                }
                
                console.log(`✅ Messages trouvés dans GitHub pour ${ref} (${threadMessages.length} messages)`);
              }
            }
          } catch (archiveErr) {
            console.warn(`⚠️ Erreur récupération archive GitHub pour ${ref}:`, archiveErr);
            // Non bloquant - on continue
          }
        }
      }
    }

    // ✅ FONCTION : Déterminer le type
    function determineType(
      requestType: string | null | undefined,
      storedType: string | null | undefined,
      company: string | null,
      reason: string
    ): "partner" | "sponsor" | "client" | "supplier" | "advertising" | "communication" | "divers" | "player" {
      
      // ✅ PRIORITÉ 1 : Utiliser le request_type du payload s'il est présent
      if (requestType) {
        const validTypes = ["partner", "sponsor", "client", "supplier", "advertising", "communication", "divers", "player"];
        if (validTypes.includes(requestType)) {
          return requestType as "partner" | "sponsor" | "client" | "supplier" | "advertising" | "communication" | "divers" | "player";
        }
      }

      // ✅ PRIORITÉ 2 : Utiliser le type stocké en base (colonne "type" ou "role")
      if (storedType) {
        const validTypes = ["partner", "sponsor", "client", "supplier", "advertising", "communication", "divers", "player"];
        if (validTypes.includes(storedType)) {
          return storedType as "partner" | "sponsor" | "client" | "supplier" | "advertising" | "communication" | "divers" | "player";
        }
      }

      // ✅ FALLBACK : Analyse par mots-clés
      const companyLower = (company || "").toLowerCase();
      const reasonLower = reason.toLowerCase();

      const keywords: Record<string, string[]> = {
        "sponsor": ["sponsor", "sponsoring", "partenaire financier", "mécène"],
        "client": ["client", "acheteur", "consommateur", "utilisateur"],
        "supplier": ["fournisseur", "prestataire", "sous-traitant", "fourniture"],
        "advertising": ["publicité", "pub", "marketing", "promotion", "annonceur"],
        "communication": ["communication", "presse", "media", "relations publiques", "rp"]
      };

      for (const [type, words] of Object.entries(keywords)) {
        for (const word of words) {
          if (companyLower.includes(word) || reasonLower.includes(word)) {
            return type as "sponsor" | "client" | "supplier" | "advertising" | "communication";
          }
        }
      }

      if (reasonLower.includes("joueur") || reasonLower.includes("player")) {
        return "player";
      }

      if (reasonLower.includes("partenaire") || reasonLower.includes("partner")) {
        return "partner";
      }

      return "divers";
    }

    // ✅ 10. Transformer les demandes EN ATTENTE en format compatible
    const pendingRequestsFormatted = (pendingRequests || []).map((request) => {
      const requestType = request.payload?.request_type || null;
      const storedType = request.type || null;
      const type = determineType(requestType, storedType, request.company, request.reason);
      
      return {
        id: request.id,
        full_name: request.full_name,
        email: request.email,
        company: request.company || null,
        phone: request.phone || null,
        reason: request.reason,
        status: "pending" as const,
        reviewed_by: request.reviewed_by || null,
        reviewed_at: request.reviewed_at || null,
        created_at: request.created_at || new Date().toISOString(),
        dossier_ref: request.dossier_ref || null,
        city: request.city || null,
        kbis_url: request.kbis_url || null,
        kbis_key: request.kbis_key || null,
        kbis_validated: request.kbis_validated || false,
        kbis_scan_result: request.kbis_scan_result || null,
        type: type,
        account_status: "not_created",
        last_message: null,
        last_message_date: null,
        has_unread: false,
      };
    });

    // ✅ 11. Transformer les partenaires (uniquement ceux avec des messages)
    const partnerRequests = (partnerAccounts || [])
      .filter((account) => {
        return dossierWithMessages.has(account.dossier_ref);
      })
      .map((account) => {
        const lastMsg = lastMessagesMap.get(account.dossier_ref);
        const type = determineType(null, account.role, account.company, "Compte partenaire VAGONDYS");
        const hasUnread = unreadDossierMap.has(account.dossier_ref) || false;
        
        // ✅ CORRECTION : Si le dossier a des messages non lus mais pas de dernier message explicite,
        // on utilise un message par défaut pour le frontend
        let lastMessageContent = lastMsg?.content || null;
        let lastMessageDate = lastMsg?.created_at || null;
        
        // Si hasUnread est true mais qu'il n'y a pas de dernier message (cas des messages système),
        // on utilise un message par défaut
        if (hasUnread && !lastMessageContent) {
          lastMessageContent = "Nouveau message non lu";
          lastMessageDate = new Date().toISOString();
        }
        
        return {
          id: account.id || `partner_${Date.now()}`,
          full_name: account.full_name || "Partenaire",
          email: account.email || "",
          company: account.company || null,
          phone: account.phone || null,
          reason: "Compte partenaire VAGONDYS",
          status: "approved" as const,
          reviewed_by: account.created_by || "system",
          reviewed_at: account.updated_at || account.created_at,
          created_at: account.created_at || new Date().toISOString(),
          dossier_ref: account.dossier_ref || null,
          city: null,
          kbis_url: null,
          kbis_key: null,
          kbis_validated: false,
          kbis_scan_result: null,
          type: type,
          account_status: account.status === "active" ? "active" : "inactive",
          last_message: lastMessageContent,
          last_message_date: lastMessageDate,
          has_unread: hasUnread,
        };
      });

    // ✅ 12. Transformer les joueurs (uniquement ceux avec des messages)
    const playerRequests = (players || [])
      .filter((player) => {
        return dossierWithMessages.has(player.dossier_ref);
      })
      .map((player) => {
        const lastMsg = lastMessagesMap.get(player.dossier_ref);
        const hasUnread = unreadDossierMap.has(player.dossier_ref) || false;
        
        // ✅ CORRECTION : Si le dossier a des messages non lus mais pas de dernier message explicite
        let lastMessageContent = lastMsg?.content || null;
        let lastMessageDate = lastMsg?.created_at || null;
        
        if (hasUnread && !lastMessageContent) {
          lastMessageContent = "Nouveau message non lu";
          lastMessageDate = new Date().toISOString();
        }
        
        return {
          id: player.id || `player_${Date.now()}`,
          full_name: player.full_name || "Joueur",
          email: player.email || "",
          company: null,
          phone: player.phone || null,
          reason: "Joueur actif VAGONDYS",
          status: "approved" as const,
          reviewed_by: "system",
          reviewed_at: player.created_at || new Date().toISOString(),
          created_at: player.created_at || new Date().toISOString(),
          dossier_ref: player.dossier_ref || null,
          city: player.city || null,
          kbis_url: null,
          kbis_key: null,
          kbis_validated: false,
          kbis_scan_result: null,
          type: "player" as const,
          account_status: player.status === "ACTIF" ? "active" : "inactive",
          last_message: lastMessageContent,
          last_message_date: lastMessageDate,
          has_unread: hasUnread,
        };
      });

    // ✅ 13. Fusionner les trois listes
    const allRequests = [...pendingRequestsFormatted, ...partnerRequests, ...playerRequests];

    // ✅ 14. TRI : les messages non lus remontent en premier, puis alphabétique
    allRequests.sort((a, b) => {
      if (a.has_unread && !b.has_unread) return -1;
      if (!a.has_unread && b.has_unread) return 1;
      
      const nameA = a.full_name?.toLowerCase() || "";
      const nameB = b.full_name?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });

    // ✅ 15. Récupérer les comptes messagerie associés (pour le statut d'activation)
    const emails = allRequests.map(r => r.email);
    
    if (emails.length > 0) {
      const { data: accounts, error: accountsError } = await supabaseAdmin
        .from("messagerie_accounts")
        .select("email, status")
        .in("email", emails);

      if (accountsError) {
        console.error("Erreur récupération comptes messagerie:", accountsError);
        // Non bloquant – on continue sans le statut
      }

      const accountStatusMap = new Map();
      if (accounts) {
        for (const account of accounts) {
          accountStatusMap.set(account.email, account.status);
        }
      }

      const enrichedRequests = allRequests.map(request => ({
        ...request,
        account_status: accountStatusMap.get(request.email) || "not_created",
      }));

      return NextResponse.json({ requests: enrichedRequests });
    } else {
      console.log("ℹ️ Aucune requête à enrichir avec account_status");
      return NextResponse.json({ requests: allRequests });
    }
  } catch (error) {
    console.error("Erreur API staff/messagerie-requests:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
