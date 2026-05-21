
// app/api/staff/dashboard-stats/route.ts
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

    // Récupérer les données
    const [athletes, athletesActifs, nouveauxAthletes, topPlayers] = await Promise.all([
      publicClient.from("athletes").select("*", { count: "exact", head: true }),
      publicClient
        .from("athletes")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIF"),
      publicClient
        .from("athletes")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      publicClient
        .from("athletes")
        .select("id, pseudo, full_name, points, rank")
        .order("points", { ascending: false })
        .limit(5),
    ]);

    // Récupérer les messages non lus depuis STAFF
    const staffClient = await createDynamicClient(city, country, "STAFF");
    const { count: pendingMessages } = await staffClient
      .from("pending_signals")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);

    return NextResponse.json({
      totalAthletes: athletes.count || 0,
      activeAthletes: athletesActifs.count || 0,
      newAthletesThisMonth: nouveauxAthletes.count || 0,
      pendingMessages: pendingMessages || 0,
      topPlayers: topPlayers.data || [],
    });
  } catch (error) {
    console.error("Erreur API dashboard-stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
