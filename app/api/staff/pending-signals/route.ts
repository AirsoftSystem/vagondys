
// app/api/staff/pending-signals/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getStaffCity } from "@/actions/staff-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "pending";

    // ✅ Récupérer la ville de l'agent DEPUIS LA SESSION (Server Action)
    const { city, country, email: agentEmail } = await getStaffCity();

    if (!city || !agentEmail) {
      return NextResponse.json({ error: "Agent non identifié" }, { status: 401 });
    }

    console.log(`🔍 API pending-signals pour ${city} (${country}) - vue: ${view}`);

    // ✅ Client ADMIN dynamique pour la ville de l'agent
    const adminClient = await createAdminClient(city, country || "FR", "STAFF");

    let query = adminClient
      .from("pending_signals")
      .select("*")
      .order("created_at", { ascending: false });

    // Filtrer par statut de lecture
    if (view === "pending") {
      query = query.eq("is_read", false);
    } else {
      query = query.eq("is_read", true);
    }

    query = query.eq("confirmed", true);

    // Filtrage par mot-clé selon l'email de l'agent
    const admins = ["contact@vagondys.com", "vagondys@gmail.com", "admin@vagondys.com"];
    if (!admins.includes(agentEmail.toLowerCase())) {
      const lowerEmail = agentEmail.toLowerCase();
      let keyword = "";
      if (lowerEmail.includes("communication")) keyword = "communication";
      else if (lowerEmail.includes("sponsors")) keyword = "sponsor";
      else if (lowerEmail.includes("ligue")) keyword = "ligue";
      else if (lowerEmail.includes("competition")) keyword = "competition";
      else if (lowerEmail.includes("tournois")) keyword = "tournoi";
      else if (lowerEmail.includes("player")) keyword = "player";
      else if (lowerEmail.includes("licence")) keyword = "licence";
      else if (lowerEmail.includes("reservations")) keyword = "reservation";
      else if (lowerEmail.includes(city.toLowerCase())) keyword = city.toLowerCase();

      if (keyword) {
        query = query.or(`payload->>subject.ilike.%${keyword}%,payload->>message.ilike.%${keyword}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ API pending-signals error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [], city, country });

  } catch (error) {
    console.error("❌ API pending-signals exception:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
