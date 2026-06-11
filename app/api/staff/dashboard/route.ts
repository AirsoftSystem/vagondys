
// app/api/staff/dashboard/route.ts
import { NextResponse } from "next/server";

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

    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ✅ VÉRIFICATION CRITIQUE : Les variables doivent exister
    if (!supabaseUrl) {
      console.error("❌ Dashboard API: NEXT_PUBLIC_SUPABASE_URL manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    if (!supabaseServiceKey) {
      console.error("❌ Dashboard API: SUPABASE_SERVICE_ROLE_KEY manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client ADMIN avec SERVICE_ROLE (côté serveur, créé à l'exécution)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cityUpper = city.toUpperCase().trim();
    const countryUpper = country.toUpperCase().trim();
    
    // ✅ Détection des admins (MASTER) pour qu'ils voient TOUTES les données
    const isAdmin = cityUpper === 'MASTER';

    // Récupérer toutes les données nécessaires pour le dashboard (avec ou sans filtre city selon le rôle)
    let athletesResult, activeAthletesResult, messagesResult, launchesResult;
    let recentMessagesResult, recentLaunchesResult, recentMatchesResult, topPlayersResult;

    if (isAdmin) {
      // ✅ ADMIN (MASTER) : PAS de filtre city - voit TOUTES les données
      console.log("🔍 Dashboard API: Mode ADMIN - pas de filtre city");
      
      [athletesResult, activeAthletesResult, messagesResult, launchesResult, recentMessagesResult, recentLaunchesResult, recentMatchesResult, topPlayersResult] = await Promise.all([
        adminClient.from("athletes").select("*", { count: "exact", head: true }),
        adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("status", "ACTIF"),
        adminClient.from("pending_signals").select("*", { count: "exact", head: true }).eq("is_read", false),
        adminClient.from("game_launches").select("*", { count: "exact", head: true }),
        adminClient.from("pending_signals").select("*").order("created_at", { ascending: false }).limit(3),
        adminClient.from("game_launches").select("*").order("created_at", { ascending: false }).limit(3),
        adminClient.from("match_history").select("*, athletes(pseudo, full_name)").order("date", { ascending: false }).limit(3),
        adminClient.from("athletes").select("id, pseudo, full_name, points, rank").order("points", { ascending: false }).limit(5),
      ]);
    } else {
      // ✅ AGENT STANDARD : filtre par city ET country
      console.log("🔍 Dashboard API: Mode STANDARD - filtre city=", cityUpper);
      
      [athletesResult, activeAthletesResult, messagesResult, launchesResult, recentMessagesResult, recentLaunchesResult, recentMatchesResult, topPlayersResult] = await Promise.all([
        adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper),
        adminClient.from("athletes").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper).eq("status", "ACTIF"),
        adminClient.from("pending_signals").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper).eq("is_read", false),
        adminClient.from("game_launches").select("*", { count: "exact", head: true }).eq("city", cityUpper).eq("country", countryUpper),
        adminClient.from("pending_signals").select("*").eq("city", cityUpper).eq("country", countryUpper).order("created_at", { ascending: false }).limit(3),
        adminClient.from("game_launches").select("*").eq("city", cityUpper).eq("country", countryUpper).order("created_at", { ascending: false }).limit(3),
        adminClient.from("match_history").select("*, athletes(pseudo, full_name)").eq("city", cityUpper).eq("country", countryUpper).order("date", { ascending: false }).limit(3),
        adminClient.from("athletes").select("id, pseudo, full_name, points, rank").eq("city", cityUpper).eq("country", countryUpper).order("points", { ascending: false }).limit(5),
      ]);
    }

    // Traitement des activités récentes
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
        let matchesQuery = adminClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id);
        
        let winsQuery = adminClient
          .from("match_history")
          .select("*", { count: "exact", head: true })
          .eq("player_id", player.id)
          .eq("win", true);
        
        // ✅ Pour les agents standards, ajouter le filtre city/country
        if (!isAdmin) {
          matchesQuery = matchesQuery.eq("city", cityUpper).eq("country", countryUpper);
          winsQuery = winsQuery.eq("city", cityUpper).eq("country", countryUpper);
        }
        
        const { count: matchesPlayed } = await matchesQuery;
        const { count: wins } = await winsQuery;

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
