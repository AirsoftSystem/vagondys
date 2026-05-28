
// app/api/staff/public-data/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const country = searchParams.get("country") || "FR";

    if (!city) {
      return NextResponse.json({ error: "Ville manquante" }, { status: 400 });
    }

    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client UNIQUE avec service_role (Option B)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Récupérer les données avec filtres city et country
    const [athletesResult, activeAthletesResult, newAthletesResult, recentMatchesResult, topPlayersResult] = await Promise.all([
      supabaseAdmin.from("athletes").select("*", { count: "exact", head: true }).eq("city", city).eq("country", country),
      supabaseAdmin.from("athletes").select("*", { count: "exact", head: true }).eq("city", city).eq("country", country).eq("status", "ACTIF"),
      supabaseAdmin.from("athletes").select("*", { count: "exact", head: true }).eq("city", city).eq("country", country).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabaseAdmin.from("match_history").select("*, athletes(pseudo, full_name)").eq("city", city).eq("country", country).order("date", { ascending: false }).limit(3),
      supabaseAdmin.from("athletes").select("id, pseudo, full_name, points, rank").eq("city", city).eq("country", country).order("points", { ascending: false }).limit(5),
    ]);

    // Traitement des top joueurs avec leurs stats
    const topPlayers = [];
    if (topPlayersResult.data) {
      for (const player of topPlayersResult.data) {
        const { count: matchesPlayed } = await supabaseAdmin
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id)
          .eq("city", city)
          .eq("country", country);

        const { count: wins } = await supabaseAdmin
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id)
          .eq("city", city)
          .eq("country", country)
          .eq("win", true);

        const totalMatches = matchesPlayed || 0;
        const winRate = totalMatches > 0 ? Math.round((wins || 0) / totalMatches * 100) : 0;

        topPlayers.push({
          id: player.id,
          pseudo: player.pseudo,
          full_name: player.full_name,
          points: player.points || 0,
          rank: player.rank || "RECRUE",
          matchesPlayed: totalMatches,
          winRate,
        });
      }
    }

    // Traitement des matchs récents
    const recentMatches = [];
    if (recentMatchesResult.data) {
      for (const match of recentMatchesResult.data) {
        recentMatches.push({
          id: match.id,
          date: match.date,
          score: match.score,
          win: match.win,
          playerName: match.athletes?.pseudo || match.athletes?.full_name || "Joueur",
        });
      }
    }

    return NextResponse.json({
      totalAthletes: athletesResult.count || 0,
      activeAthletes: activeAthletesResult.count || 0,
      newAthletesThisMonth: newAthletesResult.count || 0,
      topPlayers: topPlayers,
      recentMatches: recentMatches,
    });

  } catch (error) {
    console.error("Erreur API public-data:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
