
// app/api/staff/public-data/route.ts
import { NextResponse } from "next/server";
import { createDynamicClient } from "@/lib/supabase/master";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const country = searchParams.get("country") || "FR";

    if (!city) {
      return NextResponse.json({ error: "Ville manquante" }, { status: 400 });
    }

    // ✅ Client PUBLIC avec service_role pour lire athletes et match_history
    const publicClient = await createDynamicClient(city, country, "PUBLIC");

    // Récupérer les données PUBLIC
    const [athletesResult, activeAthletesResult, newAthletesResult, recentMatchesResult, topPlayersResult] = await Promise.all([
      publicClient.from("athletes").select("*", { count: "exact", head: true }),
      publicClient.from("athletes").select("*", { count: "exact", head: true }).eq("status", "ACTIF"),
      publicClient.from("athletes").select("*", { count: "exact", head: true }).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      publicClient.from("match_history").select("*, athletes(pseudo, full_name)").order("date", { ascending: false }).limit(3),
      publicClient.from("athletes").select("id, pseudo, full_name, points, rank").order("points", { ascending: false }).limit(5),
    ]);

    // Traitement des top joueurs avec leurs stats
    const topPlayers = [];
    if (topPlayersResult.data) {
      for (const player of topPlayersResult.data) {
        const { count: matchesPlayed } = await publicClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id);

        const { count: wins } = await publicClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id)
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
