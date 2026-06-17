
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
    // ✅ Exclusion du compte admin VGD-ADMIN001
    const { data: partnerAccounts, error: fetchPartnerError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("*")
      .neq("dossier_ref", "VGD-ADMIN001") // ✅ Exclusion du compte admin
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
    const dossierWithMessages = new Set<string>(); // ✅ CORRECTION : let → const

    if (allDossierRefs.length > 0) {
      // Récupérer tous les messages par dossier
      const { data: allMessages, error: messagesError } = await supabaseAdmin
        .from("messagerie_messages")
        .select("dossier_ref, content, created_at, sender_name")
        .in("dossier_ref", allDossierRefs)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("Erreur récupération messages:", messagesError);
      } else if (allMessages) {
        // Construire un Set des dossiers qui ont des messages
        for (const msg of allMessages) {
          dossierWithMessages.add(msg.dossier_ref);
        }
        
        // Garder uniquement le plus récent par dossier
        const tempMap = new Map<string, { content: string; created_at: string; sender_name: string }>();
        for (const msg of allMessages) {
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
    }

    // ✅ 10. Transformer les demandes EN ATTENTE en format compatible
    const pendingRequestsFormatted = (pendingRequests || []).map((request) => ({
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
      type: "pending" as const, // ✅ Type "pending" pour les demandes en attente
      account_status: "not_created",
      last_message: null,
      last_message_date: null,
    }));

    // ✅ 11. Transformer les partenaires (uniquement ceux avec des messages)
    const partnerRequests = (partnerAccounts || [])
      .filter((account) => {
        // ✅ Ne garder que les comptes qui ont des messages
        return dossierWithMessages.has(account.dossier_ref);
      })
      .map((account) => {
        const lastMsg = lastMessagesMap.get(account.dossier_ref);
        
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
          type: "partner" as const, // ✅ Type "partner" pour les conversations actives
          account_status: account.status === "active" ? "active" : "inactive",
          last_message: lastMsg?.content || null,
          last_message_date: lastMsg?.created_at || null,
        };
      });

    // ✅ 12. Transformer les joueurs (uniquement ceux avec des messages)
    const playerRequests = (players || [])
      .filter((player) => {
        // ✅ Ne garder que les joueurs qui ont des messages
        return dossierWithMessages.has(player.dossier_ref);
      })
      .map((player) => {
        const lastMsg = lastMessagesMap.get(player.dossier_ref);
        
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
          type: "player" as const, // ✅ Type "player" pour les joueurs actifs
          account_status: player.status === "ACTIF" ? "active" : "inactive",
          last_message: lastMsg?.content || null,
          last_message_date: lastMsg?.created_at || null,
        };
      });

    // ✅ 13. Fusionner les trois listes
    const allRequests = [...pendingRequestsFormatted, ...partnerRequests, ...playerRequests];

    // Trier par date (les demandes en attente en premier, puis par date du dernier message)
    allRequests.sort((a, b) => {
      // Les demandes en attente passent en premier
      if (a.type === "pending" && b.type !== "pending") return -1;
      if (b.type === "pending" && a.type !== "pending") return 1;
      
      // Sinon trier par date du dernier message décroissante
      const dateA = a.last_message_date ? new Date(a.last_message_date).getTime() : 0;
      const dateB = b.last_message_date ? new Date(b.last_message_date).getTime() : 0;
      return dateB - dateA;
    });

    // ✅ 14. Récupérer les comptes messagerie associés (pour le statut d'activation)
    const emails = allRequests.map(r => r.email);
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("email, status")
      .in("email", emails);

    if (accountsError) {
      console.error("Erreur récupération comptes messagerie:", accountsError);
      // Non bloquant – on continue sans le statut
    }

    // ✅ 15. Construire un map email -> status
    const accountStatusMap = new Map();
    if (accounts) {
      for (const account of accounts) {
        accountStatusMap.set(account.email, account.status);
      }
    }

    // ✅ 16. Ajouter le champ account_status à chaque demande
    const enrichedRequests = allRequests.map(request => ({
      ...request,
      account_status: accountStatusMap.get(request.email) || "not_created",
    }));

    return NextResponse.json({ requests: enrichedRequests });
  } catch (error) {
    console.error("Erreur API staff/messagerie-requests:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
