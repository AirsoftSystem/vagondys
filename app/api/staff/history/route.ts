
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getStaffCity } from "@/actions/staff-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierRef = searchParams.get("ref");
    const email = searchParams.get("email");
    const cityParam = searchParams.get("city");
    const countryParam = searchParams.get("country") || "FR";

    if (!dossierRef) {
      return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
    }

    console.log(`🔍 history: recherche pour dossier ${dossierRef}`);

    // Récupérer la ville de l'agent (ou utiliser le paramètre)
    let city = cityParam;
    let country = countryParam;
    
    if (!city) {
      const staffInfo = await getStaffCity();
      city = staffInfo.city;
      country = staffInfo.country || "FR";
      console.log(`📍 history: ville détectée depuis session: ${city}`);
    } else {
      console.log(`📍 history: ville depuis paramètre: ${city}`);
    }
    
    if (!city) {
      console.error("❌ history: aucune ville trouvée");
      return NextResponse.json({ error: "Agent non identifié" }, { status: 401 });
    }

    // Client ADMIN pour la base STAFF de la ville
    const adminClient = await createAdminClient(city, country, "STAFF");
    console.log(`✅ history: client ADMIN créé pour ${city}`);

    // 1. Récupérer les réponses du staff
    const { data: replies, error: repliesError } = await adminClient
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: true });

    if (repliesError) {
      console.error("❌ history: erreur récupération replies:", repliesError);
    } else {
      console.log(`📦 history: ${replies?.length || 0} réponses staff trouvées`);
    }

    // 2. Récupérer les messages du client
    const { data: clientMessages, error: clientError } = await adminClient
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: true });

    if (clientError) {
      console.error("❌ history: erreur récupération clientMessages:", clientError);
    } else {
      console.log(`📦 history: ${clientMessages?.length || 0} messages client trouvés`);
    }

    // 3. Formater les messages pour l'affichage
    const clientHistory = (clientMessages || []).map(m => ({
      id: m.id,
      created_at: m.created_at,
      agent_email: "CLIENT",
      content: m.payload?.message || "(message vide)",
      dossier_ref: m.dossier_ref,
      document_url: null
    }));

    const staffHistory = (replies || []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      agent_email: r.agent_email,
      content: r.content,
      dossier_ref: r.dossier_ref,
      document_url: r.document_url || null
    }));

    // 4. Fusionner et trier par date (du plus ancien au plus récent)
    const allMessages = [...clientHistory, ...staffHistory];
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    console.log(`✅ history: ${allMessages.length} messages au total pour ${dossierRef}`);

    // Si email est fourni, on pourrait aussi chercher les dossiers liés
    if (email && clientMessages && clientMessages.length > 0) {
      console.log(`🔗 history: recherche dossiers liés pour ${email}`);
      // Optionnel: recherche des autres dossiers du même client
      // À implémenter si besoin
    }

    return NextResponse.json({ history: allMessages });

  } catch (error) {
    console.error("❌ API history error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
