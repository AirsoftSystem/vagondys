
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * API de récupération des demandes d’inscription à la messagerie privée
 * GET /api/staff/messagerie-requests
 * 
 * Sécurité : Réservé au staff (email @vagondys.com ou dans staff_registry)
 * 
 * ✅ CORRECTION : Ajout du statut d'activation du compte (messagerie_accounts.status)
 * ✅ AJOUT : Récupération des JOUEURS (athlètes) en plus des PARTENAIRES
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

    // ✅ 4. Récupérer les demandes PARTENAIRES (pending_messagerie_requests)
    const { data: partnerRequests, error: fetchPartnerError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchPartnerError) {
      console.error("Erreur récupération demandes partenaires:", fetchPartnerError);
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

    // ✅ 6. Transformer les joueurs en format compatible avec MessagerieRequest
    const playerRequests = (players || []).map((player) => ({
      id: player.id || `player_${Date.now()}`,
      full_name: player.full_name || "Joueur",
      email: player.email || "",
      company: null,
      phone: player.phone || null,
      reason: "Joueur actif VAGONDYS - Accès à la messagerie",
      status: "approved" as const, // Les joueurs sont déjà approuvés
      reviewed_by: "system",
      reviewed_at: player.created_at || new Date().toISOString(),
      created_at: player.created_at || new Date().toISOString(),
      dossier_ref: player.dossier_ref || null,
      city: player.city || null,
      type: "player" as const, // ✅ Type "player" pour identifier les joueurs
      account_status: player.status === "ACTIF" ? "active" : "inactive",
    }));

    // ✅ 7. Transformer les partenaires en format compatible avec MessagerieRequest
    const partnerRequestsFormatted = (partnerRequests || []).map((request) => ({
      ...request,
      type: "partner" as const, // ✅ Type "partner" pour identifier les partenaires
    }));

    // ✅ 8. Fusionner les deux listes
    const allRequests = [...partnerRequestsFormatted, ...playerRequests];

    // Trier par date décroissante (plus récent en premier)
    allRequests.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    // ✅ 9. Récupérer les comptes messagerie associés (pour le statut d'activation)
    const emails = allRequests.map(r => r.email);
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("email, status")
      .in("email", emails);

    if (accountsError) {
      console.error("Erreur récupération comptes messagerie:", accountsError);
      // Non bloquant – on continue sans le statut
    }

    // ✅ 10. Construire un map email -> status
    const accountStatusMap = new Map();
    if (accounts) {
      for (const account of accounts) {
        accountStatusMap.set(account.email, account.status);
      }
    }

    // ✅ 11. Ajouter le champ account_status à chaque demande
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
