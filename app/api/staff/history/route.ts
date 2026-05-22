
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getStaffCity } from "@/actions/staff-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierRef = searchParams.get("ref");
    // ✅ Paramètre email conservé pour usage futur (dossiers liés)
    const email = searchParams.get("email");

    if (!dossierRef) {
      return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
    }

    // Récupérer la ville de l'agent
    const { city, country } = await getStaffCity();
    if (!city) {
      return NextResponse.json({ error: "Agent non identifié" }, { status: 401 });
    }

    // Client ADMIN pour la base STAFF de la ville
    const adminClient = await createAdminClient(city, country || "FR", "STAFF");

    // 1. Récupérer les réponses du staff
    const { data: replies } = await adminClient
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: true });

    // 2. Récupérer les messages du client
    const { data: clientMessages } = await adminClient
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: true });

    // 3. Formater les messages pour l'affichage
    const clientHistory = (clientMessages || []).map(m => ({
      id: m.id,
      created_at: m.created_at,
      agent_email: "CLIENT",
      content: m.payload.message,
      dossier_ref: m.dossier_ref,
      document_url: null
    }));

    const staffHistory = (replies || []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      agent_email: r.agent_email,
      content: r.content,
      dossier_ref: r.dossier_ref,
      document_url: r.document_url
    }));

    // 4. Fusionner et trier par date
    const allMessages = [...clientHistory, ...staffHistory];
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Si email est fourni, on pourrait aussi chercher les dossiers liés
    if (email && clientMessages && clientMessages.length > 0) {
      // Optionnel: recherche des autres dossiers du même client
      // À implémenter si besoin
    }

    return NextResponse.json({ history: allMessages });

  } catch (error) {
    console.error("❌ API history error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
