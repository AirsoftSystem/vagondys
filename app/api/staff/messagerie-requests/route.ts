
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
 * ✅ CORRECTION : Lecture depuis messagerie_accounts + messagerie_messages
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

    // ✅ 4. Récupérer les comptes PARTENAIRES (messagerie_accounts)
    const { data: partnerAccounts, error: fetchPartnerError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchPartnerError) {
      console.error("Erreur récupération comptes partenaires:", fetchPartnerError);
      // Non bloquant - on continue
    }

    // ✅ 5. Récupérer les JOUEURS (athlètes) avec un dossier_ref
    const { data: players, error: fetchPlayersError } = await supabaseAdmin
      .from("athletes")
      .select("id, full_name, email, phone, dossier_ref, city, country, created_at, status")
      .not("dossier_ref", "is", null)
      .order("created_at", { ascending: false });

    if (fetchPlayersError) {
      console.error("Erreur récupération joueurs:", fetchPlayersError);
      // Non bloquant - on continue
    }

    // ✅ 6. Récupérer les derniers messages pour chaque dossier
    const allDossierRefs: string[] = [];
    
    // Ajouter les dossier_ref des partenaires
    if (partnerAccounts) {
      for (const account of partnerAccounts) {
        if (account.dossier_ref) {
          allDossierRefs.push(account.dossier_ref);
        }
      }
    }
    
    // Ajouter les dossier_ref des joueurs
    if (players) {
      for (const player of players) {
        if (player.dossier_ref) {
          allDossierRefs.push(player.dossier_ref);
        }
      }
    }

    // ✅ 7. Récupérer le dernier message pour chaque dossier (en une seule requête)
    let lastMessagesMap = new Map<string, { content: string; created_at: string; sender_name: string }>();
    
    if (allDossierRefs.length > 0) {
      // Récupérer les derniers messages par dossier
      const { data: lastMessages, error: messagesError } = await supabaseAdmin
        .from("messagerie_messages")
        .select("dossier_ref, content, created_at, sender_name")
        .in("dossier_ref", allDossierRefs)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("Erreur récupération derniers messages:", messagesError);
      } else if (lastMessages) {
        // Garder uniquement le plus récent par dossier
        const tempMap = new Map<string, { content: string; created_at: string; sender_name: string }>();
        for (const msg of lastMessages) {
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

    // ✅ 8. Transformer les partenaires en format compatible avec MessagerieRequest
    const partnerRequests = (partnerAccounts || []).map((account) => {
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
        type: "partner" as const,
        account_status: account.status === "active" ? "active" : "inactive",
        last_message: lastMsg?.content || null,
        last_message_date: lastMsg?.created_at || null,
      };
    });

    // ✅ 9. Transformer les joueurs en format compatible avec MessagerieRequest
    const playerRequests = (players || []).map((player) => {
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
        type: "player" as const,
        account_status: player.status === "ACTIF" ? "active" : "inactive",
        last_message: lastMsg?.content || null,
        last_message_date: lastMsg?.created_at || null,
      };
    });

    // ✅ 10. Fusionner les deux listes
    const allRequests = [...partnerRequests, ...playerRequests];

    // Trier par date du dernier message décroissante (plus récent en premier)
    allRequests.sort((a, b) => {
      const dateA = a.last_message_date ? new Date(a.last_message_date).getTime() : 0;
      const dateB = b.last_message_date ? new Date(b.last_message_date).getTime() : 0;
      return dateB - dateA;
    });

    // ✅ 11. Récupérer les comptes messagerie associés (pour le statut d'activation)
    const emails = allRequests.map(r => r.email);
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("email, status")
      .in("email", emails);

    if (accountsError) {
      console.error("Erreur récupération comptes messagerie:", accountsError);
      // Non bloquant – on continue sans le statut
    }

    // ✅ 12. Construire un map email -> status
    const accountStatusMap = new Map();
    if (accounts) {
      for (const account of accounts) {
        accountStatusMap.set(account.email, account.status);
      }
    }

    // ✅ 13. Ajouter le champ account_status à chaque demande
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
