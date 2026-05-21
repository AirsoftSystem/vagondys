
// app/api/staff/dashboard/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Interface pour typer les activités
interface Activity {
  id: string;
  type: "message" | "game_launch" | "match";
  title: string;
  description: string;
  timestamp: string;
  link: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const country = searchParams.get("country") || "FR";

    if (!city) {
      return NextResponse.json({ error: "Ville manquante" }, { status: 400 });
    }

    // ✅ Utilisation du client ADMIN avec SERVICE_ROLE (côté serveur)
    // Cette clé n'est JAMAIS exposée au navigateur
    const adminClient = await createAdminClient(city, country, "STAFF");

    // Récupérer toutes les données nécessaires pour le dashboard
    const [athletesResult, activeAthletesResult, messagesResult, launchesResult, recentMessagesResult, recentLaunchesResult, recentMatchesResult, topPlayersResult] = await Promise.all([
      adminClient.from("athletes").select("*", { count: "exact", head: true }),
      adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("status", "ACTIF"),
      adminClient.from("pending_signals").select("*", { count: "exact", head: true }).eq("is_read", false),
      adminClient.from("game_launches").select("*", { count: "exact", head: true }),
      adminClient.from("pending_signals").select("*").order("created_at", { ascending: false }).limit(3),
      adminClient.from("game_launches").select("*").order("created_at", { ascending: false }).limit(3),
      adminClient.from("match_history").select("*, athletes(pseudo, full_name)").order("date", { ascending: false }).limit(3),
      adminClient.from("athletes").select("id, pseudo, full_name, points, rank").order("points", { ascending: false }).limit(5),
    ]);

    // Traitement des activités récentes - Déclaration avec type explicite
    const activities: Activity[] = [];

    if (recentMessagesResult.data) {
      recentMessagesResult.data.forEach(msg => {
        activities.push({
          id: msg.id,
          type: "message",
          title: msg.payload?.subject || "Nouveau message",
          description: `De: ${msg.payload?.email || "inconnu"}`,
          timestamp: msg.created_at,
          link: "/staff/interface",
        });
      });
    }

    if (recentLaunchesResult.data) {
      recentLaunchesResult.data.forEach(launch => {
        activities.push({
          id: launch.id,
          type: "game_launch",
          title: `Partie ${launch.game_mode} lancée`,
          description: `Par: ${launch.agent_email}`,
          timestamp: launch.created_at,
          link: "/staff/mode_jeux",
        });
      });
    }

    if (recentMatchesResult.data) {
      recentMatchesResult.data.forEach(match => {
        const playerName = match.athletes?.pseudo || match.athletes?.full_name || "Joueur";
        activities.push({
          id: match.id,
          type: "match",
          title: `Match terminé - ${match.win ? "Victoire" : "Défaite"}`,
          description: `${playerName} - ${match.score} pts`,
          timestamp: match.date,
          link: "/staff/licencies",
        });
      });
    }

    // Trier par date décroissante
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Traitement des top joueurs
    const topPlayers = [];
    if (topPlayersResult.data) {
      for (const player of topPlayersResult.data) {
        const { count: matchesPlayed } = await adminClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id);

        const { count: wins } = await adminClient
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

    return NextResponse.json({
      totalAthletes: athletesResult.count || 0,
      activeAthletes: activeAthletesResult.count || 0,
      pendingMessages: messagesResult.count || 0,
      totalGameLaunches: launchesResult.count || 0,
      recentActivities: activities,
      topPlayers: topPlayers,
    });

  } catch (error) {
    console.error("Erreur API dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
