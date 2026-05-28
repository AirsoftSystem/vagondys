
// app/api/player/token/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * API pour le STAFF : Récupérer un access_token joueur
 * Version adaptée pour l'Option B (un seul projet Supabase)
 * 
 * Méthode : GET
 * Paramètres :
 *   - identifier : email OU pseudo du joueur
 *   - city : ville du joueur (ex: NANTES)
 *   - country : pays (FR par défaut)
 * 
 * Retour :
 *   - { success: true, player: {...}, access_token: "..." }
 */

export async function GET(request: NextRequest) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ✅ Vérification des variables critiques
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const identifier = searchParams.get("identifier");
    const cityCode = searchParams.get("city") || "NANTES";
    const countryCode = searchParams.get("country") || "FR";

    // 1. Vérification de l'authentification STAFF
    const authHeader = request.headers.get("authorization");
    const staffToken = authHeader?.replace("Bearer ", "");

    if (!staffToken) {
      console.error("[player/token] 401 - Token manquant dans l'en-tête Authorization");
      return NextResponse.json(
        { error: "Accès STAFF non autorisé. Token manquant." },
        { status: 401 }
      );
    }

    console.log(`[player/token] Token reçu: ${staffToken.substring(0, 20)}... (longueur: ${staffToken.length})`);

    // ✅ Vérification avec le projet UNIQUE
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user: staffUser }, error: staffAuthError } = await supabaseClient.auth.getUser(staffToken);

    if (staffAuthError) {
      console.error(`[player/token] 401 - Erreur auth getUser: ${staffAuthError.message}`);
      return NextResponse.json(
        { error: "Token STAFF invalide ou expiré." },
        { status: 401 }
      );
    }

    if (!staffUser) {
      console.error("[player/token] 401 - Aucun utilisateur trouvé pour ce token");
      return NextResponse.json(
        { error: "Token STAFF invalide ou expiré." },
        { status: 401 }
      );
    }

    console.log(`[player/token] Utilisateur STAFF trouvé: ${staffUser.email}`);

    // Vérifier que l'utilisateur a bien un rôle STAFF
    const isStaff = staffUser.user_metadata?.role === "staff" || 
                    staffUser.email?.includes("staff") ||
                    staffUser.email === "vagondys@gmail.com";

    if (!isStaff) {
      console.error(`[player/token] 403 - Utilisateur ${staffUser.email} n'a pas les droits STAFF.`);
      return NextResponse.json(
        { error: "Accès réservé au personnel STAFF." },
        { status: 403 }
      );
    }

    console.log(`[player/token] Autorisation STAFF validée pour ${staffUser.email}`);

    // 2. Valider les paramètres
    if (!identifier) {
      console.error("[player/token] 400 - Paramètre 'identifier' manquant");
      return NextResponse.json(
        { error: "Paramètre 'identifier' requis (email ou pseudo)." },
        { status: 400 }
      );
    }

    console.log(`[player/token] Recherche du joueur: identifier=${identifier}, city=${cityCode}, country=${countryCode}`);

    // 3. Connexion à la base UNIQUE (avec service_role pour lire les joueurs)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 4. Rechercher le joueur par email ou pseudo (avec filtre city)
    let playerQuery = supabaseAdmin
      .from("athletes")
      .select("id, email, full_name, pseudo, city, country, dossier_ref, status")
      .eq("city", cityCode)
      .eq("country", countryCode)
      .or(`email.ilike.%${identifier}%,pseudo.ilike.%${identifier}%`)
      .maybeSingle();

    // Si l'identifier contient un @, on cherche d'abord par email exact
    if (identifier.includes("@")) {
      playerQuery = supabaseAdmin
        .from("athletes")
        .select("id, email, full_name, pseudo, city, country, dossier_ref, status")
        .eq("city", cityCode)
        .eq("country", countryCode)
        .eq("email", identifier.toLowerCase())
        .maybeSingle();
    }

    const { data: player, error: playerError } = await playerQuery;

    if (playerError) {
      console.error("[player/token] Erreur recherche joueur:", playerError);
      return NextResponse.json(
        { error: "Erreur lors de la recherche du joueur." },
        { status: 500 }
      );
    }

    if (!player) {
      console.error(`[player/token] 404 - Aucun joueur trouvé avec ${identifier} dans ${cityCode}`);
      return NextResponse.json(
        { error: `Aucun joueur trouvé avec cet identifiant dans ${cityCode}.` },
        { status: 404 }
      );
    }

    console.log(`[player/token] Joueur trouvé: ${player.email} (status: ${player.status})`);

    // 5. Vérifier que le joueur est actif
    if (player.status !== "ACTIF") {
      console.error(`[player/token] 403 - Joueur ${player.email} non actif. Statut: ${player.status}`);
      return NextResponse.json(
        { error: `Le joueur ${player.pseudo || player.full_name} n'est pas encore activé. Statut: ${player.status}` },
        { status: 403 }
      );
    }

    // Générer un token d'accès temporaire pour le joueur
    // Le serveur Python utilisera ce token pour appeler /api/record-match
    const tempToken = Buffer.from(JSON.stringify({
      player_id: player.id,
      email: player.email,
      exp: Date.now() + 3600000, // 1 heure
      city: cityCode,
      country: countryCode
    })).toString("base64");

    console.log(`[player/token] Succès - Token généré pour ${player.email}, expiration dans 1h`);

    // 6. Retourner les informations + le token
    return NextResponse.json({
      success: true,
      player: {
        id: player.id,
        email: player.email,
        full_name: player.full_name,
        pseudo: player.pseudo,
        dossier_ref: player.dossier_ref,
        city: player.city,
        country: player.country,
        status: player.status
      },
      access_token: tempToken,
      expires_in: 3600,
      message: "Token valable 1 heure pour enregistrer les scores."
    });

  } catch (error) {
    console.error("[player/token] Erreur interne:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 }
    );
  }
}
