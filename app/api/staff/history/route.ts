
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getStaffCity } from "@/actions/staff-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierRef = searchParams.get("ref");
    // ✅ Correction : suppression de 'email' qui n'est pas utilisé
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
    // ✅ MODIFICATION : Tri décroissant (du plus récent au plus ancien)
    const { data: replies, error: repliesError } = await adminClient
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: false });

    if (repliesError) {
      console.error("❌ history: erreur récupération replies:", repliesError);
    } else {
      console.log(`📦 history: ${replies?.length || 0} réponses staff trouvées`);
    }

    // 2. Récupérer les messages du client
    // ✅ MODIFICATION : Tri décroissant (du plus récent au plus ancien)
    const { data: clientMessages, error: clientError } = await adminClient
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: false });

    if (clientError) {
      console.error("❌ history: erreur récupération clientMessages:", clientError);
    } else {
      console.log(`📦 history: ${clientMessages?.length || 0} messages client trouvés`);
    }

    // ✅ AJOUT 1 : Extraire l'email du client depuis le premier message
    let clientEmail: string | null = null;
    if (clientMessages && clientMessages.length > 0) {
      clientEmail = clientMessages[0].payload?.email || null;
      console.log(`📧 history: email client détecté: ${clientEmail}`);
    }

    // ✅ AJOUT 2 : Rechercher les autres dossiers liés au même email
    let linkedDossiers: string[] = [];
    if (clientEmail) {
      console.log(`🔗 history: recherche dossiers liés pour ${clientEmail}`);
      
      const { data: otherSignals, error: otherError } = await adminClient
        .from("pending_signals")
        .select("dossier_ref")
        .eq("payload->>email", clientEmail)
        .neq("dossier_ref", dossierRef)
        .not("dossier_ref", "is", null);

      if (!otherError && otherSignals) {
        linkedDossiers = [...new Set(otherSignals.map(s => s.dossier_ref).filter(Boolean))];
        console.log(`🔗 history: ${linkedDossiers.length} dossiers liés trouvés:`, linkedDossiers);
      }

      // Fallback : chercher aussi dans communication_replies
      if (linkedDossiers.length === 0) {
        const { data: otherReplies, error: replyError } = await adminClient
          .from("communication_replies")
          .select("dossier_ref")
          .eq("agent_email", clientEmail)
          .neq("dossier_ref", dossierRef)
          .not("dossier_ref", "is", null);

        if (!replyError && otherReplies) {
          const replyRefs = [...new Set(otherReplies.map(r => r.dossier_ref).filter(Boolean))];
          linkedDossiers = [...new Set([...linkedDossiers, ...replyRefs])];
          console.log(`🔗 history: ${replyRefs.length} dossiers liés trouvés dans replies`);
        }
      }
    }

    // 3. Formater les messages pour l'affichage
    // ✅ AJOUT 3 : Inclure le message original du client (payload.message) dans l'historique
    const clientHistory = (clientMessages || []).map((m, index) => ({
      id: m.id,
      created_at: m.created_at,
      agent_email: "CLIENT",
      content: m.payload?.message || "(message vide)",
      dossier_ref: m.dossier_ref,
      document_url: null,
      // ✅ AJOUT 4 : Marquer le premier message comme "initial"
      is_initial: index === 0 ? true : false
    }));

    const staffHistory = (replies || []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      agent_email: r.agent_email,
      content: r.content,
      dossier_ref: r.dossier_ref,
      document_url: r.document_url || null,
      is_initial: false
    }));

    // 4. Fusionner et trier par date (du plus récent au plus ancien)
    // ✅ NOTE : Les données sont déjà triées par la requête SQL (descending)
    //    On n'a donc pas besoin de re-trier ici, mais on conserve la fusion
    const allMessages = [...clientHistory, ...staffHistory];
    // ✅ Petit tri de sécurité pour garantir l'ordre décroissant
    allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`✅ history: ${allMessages.length} messages au total pour ${dossierRef}`);

    // ✅ AJOUT 5 : Retourner également les dossiers liés
    return NextResponse.json({ 
      history: allMessages,
      linkedDossiers: linkedDossiers,
      clientEmail: clientEmail
    });

  } catch (error) {
    console.error("❌ API history error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
