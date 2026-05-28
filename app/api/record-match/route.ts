
// app/api/record-match/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * API pour le serveur Python : Enregistrer les scores d'une partie
 * Version adaptée pour l'Option B (un seul projet Supabase)
 * 
 * Méthode : POST
 * Body (JSON) :
 *   - access_token : token temporaire du joueur (via /api/player/token)
 *   - score : nombre total de points
 *   - shots : nombre de tirs effectués (max 20)
 *   - kills : nombre d'éliminations (optionnel)
 *   - deaths : nombre de morts (optionnel)
 *   - assists : nombre d'assists (optionnel)
 *   - duration : temps total de la partie en secondes
 *   - shot_distribution : répartition des tirs par zone (JSONB)
 *   - game_mode : mode de jeu (ex: "PERSO", "LOISIR", "COMPETITION")
 *   - game_group : groupe de jeu (ex: "CPT1")
 * 
 * Retour :
 *   - { success: true, message: "Scores enregistrés" }
 */

interface RecordMatchBody {
  access_token: string;
  score: number;
  shots: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  hits_head?: number;
  hits_body?: number;
  hits_legs?: number;
  duration: number;
  shot_distribution?: Record<string, number>;
  game_mode?: string;
  game_group?: string;
}

export async function POST(request: NextRequest) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");

    const body: RecordMatchBody = await request.json();
    const {
      access_token,
      score,
      shots,
      kills = 0,
      deaths = 0,
      assists = 0,
      hits_head = 0,
      hits_body = 0,
      hits_legs = 0,
      duration,
      shot_distribution = {},
      game_group = "CPT1"
    } = body;

    // 1. Valider les champs obligatoires
    if (!access_token) {
      return NextResponse.json(
        { error: "access_token requis" },
        { status: 400 }
      );
    }

    if (typeof score !== "number" || score < 0) {
      return NextResponse.json(
        { error: "score invalide" },
        { status: 400 }
      );
    }

    if (typeof shots !== "number" || shots < 0 || shots > 20) {
      return NextResponse.json(
        { error: "shots invalide (0-20)" },
        { status: 400 }
      );
    }

    if (typeof duration !== "number" || duration < 0) {
      return NextResponse.json(
        { error: "duration invalide" },
        { status: 400 }
      );
    }

    // 2. Décoder le token temporaire (format base64)
    let playerId: string | null = null;
    let playerEmail: string | null = null;
    let playerCity: string | null = null;
    let playerCountry: string | null = null;

    try {
      const decoded = Buffer.from(access_token, "base64").toString("utf-8");
      const payload = JSON.parse(decoded);
      
      // Vérifier l'expiration
      if (payload.exp && payload.exp < Date.now()) {
        return NextResponse.json(
          { error: "Token expiré" },
          { status: 401 }
        );
      }
      
      playerId = payload.player_id;
      playerEmail = payload.email;
      playerCity = payload.city || "NANTES";
      playerCountry = payload.country || "FR";
    } catch (err) {
      console.error("Erreur décodage token:", err);
      return NextResponse.json(
        { error: "Token invalide" },
        { status: 401 }
      );
    }

    if (!playerId && !playerEmail) {
      return NextResponse.json(
        { error: "Token ne contient pas d'identifiant joueur" },
        { status: 401 }
      );
    }

    // 3. Connexion à la base UNIQUE (service_role pour écrire)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 4. Récupérer l'ID du joueur si on a seulement l'email (avec filtre city)
    let finalPlayerId = playerId;
    if (!finalPlayerId && playerEmail) {
      const { data: player, error: playerError } = await supabaseAdmin
        .from("athletes")
        .select("id")
        .eq("email", playerEmail.toLowerCase())
        .eq("city", playerCity || "NANTES")
        .eq("country", playerCountry || "FR")
        .maybeSingle();

      if (playerError || !player) {
        return NextResponse.json(
          { error: `Joueur non trouvé: ${playerEmail}` },
          { status: 404 }
        );
      }
      finalPlayerId = player.id;
    }

    if (!finalPlayerId) {
      return NextResponse.json(
        { error: "Impossible d'identifier le joueur" },
        { status: 400 }
      );
    }

    // 5. Insérer dans match_history (avec city et country)
    const { error: insertError } = await supabaseAdmin
      .from("match_history")
      .insert({
        player_id: finalPlayerId,
        date: new Date().toISOString(),
        duration: duration,
        score: score,
        kills: kills,
        deaths: deaths,
        assists: assists,
        shots: shots,
        hits_head: hits_head,
        hits_body: hits_body,
        hits_legs: hits_legs,
        win: true, // Par défaut, on considère que c'est une victoire
        game_group: game_group,
        shot_distribution: shot_distribution,
        city: playerCity || "NANTES",
        country: playerCountry || "FR"
      });

    if (insertError) {
      console.error("Erreur insertion match_history:", insertError);
      return NextResponse.json(
        { error: `Erreur base de données: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 6. Mettre à jour les totaux dans la table athletes
    const { data: currentAthlete, error: fetchError } = await supabaseAdmin
      .from("athletes")
      .select("total_matches, total_score, total_shots, total_kills, total_deaths, total_assists, total_hits_head, total_hits_body, total_hits_legs")
      .eq("id", finalPlayerId)
      .maybeSingle();

    if (!fetchError && currentAthlete) {
      const newTotalMatches = (currentAthlete.total_matches || 0) + 1;
      const newTotalScore = (currentAthlete.total_score || 0) + score;
      const newTotalShots = (currentAthlete.total_shots || 0) + shots;
      const newTotalKills = (currentAthlete.total_kills || 0) + kills;
      const newTotalDeaths = (currentAthlete.total_deaths || 0) + deaths;
      const newTotalAssists = (currentAthlete.total_assists || 0) + assists;
      const newTotalHitsHead = (currentAthlete.total_hits_head || 0) + hits_head;
      const newTotalHitsBody = (currentAthlete.total_hits_body || 0) + hits_body;
      const newTotalHitsLegs = (currentAthlete.total_hits_legs || 0) + hits_legs;

      await supabaseAdmin
        .from("athletes")
        .update({
          total_matches: newTotalMatches,
          total_score: newTotalScore,
          total_shots: newTotalShots,
          total_kills: newTotalKills,
          total_deaths: newTotalDeaths,
          total_assists: newTotalAssists,
          total_hits_head: newTotalHitsHead,
          total_hits_body: newTotalHitsBody,
          total_hits_legs: newTotalHitsLegs,
          updated_at: new Date().toISOString()
        })
        .eq("id", finalPlayerId);
    }

    // 7. Retourner la confirmation
    return NextResponse.json({
      success: true,
      message: "Scores enregistrés avec succès",
      player_id: finalPlayerId,
      match_recorded: true
    });

  } catch (error) {
    console.error("Erreur API /record-match:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
