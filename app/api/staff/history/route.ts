
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getStaffCity } from "@/actions/staff-actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierRef = searchParams.get("ref");
    const cityParam = searchParams.get("city");
    const countryParam = searchParams.get("country") || "FR";

    if (!dossierRef) {
      return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
    }

    console.log(`🔍 history: recherche pour dossier ${dossierRef}`);

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

    const adminClient = await createAdminClient(city, country, "STAFF");
    console.log(`✅ history: client ADMIN créé pour ${city}`);

    // 1. Récupérer les réponses du staff
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

    // 2. Récupérer le signal client (un seul par dossier)
    const { data: clientSignal, error: clientError } = await adminClient
      .from("pending_signals")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .maybeSingle();

    if (clientError) {
      console.error("❌ history: erreur récupération clientSignal:", clientError);
    } else {
      console.log(`📦 history: signal client trouvé pour ${dossierRef}`);
    }

    // 3. Extraire l'email du client
    let clientEmail: string | null = null;
    if (clientSignal?.payload?.email) {
      clientEmail = clientSignal.payload.email;
      console.log(`📧 history: email client détecté: ${clientEmail}`);
    }

    // 4. Construire l'historique des messages client depuis messages_history
    const clientHistoryMessages: Array<{
      id: string;
      created_at: string;
      agent_email: string;
      content: string;
      dossier_ref: string;
      document_url: null;
      is_initial: boolean;
    }> = [];

    if (clientSignal?.payload) {
      const payload = clientSignal.payload;
      const messagesHistory = payload.messages_history || [];
      
      // Ajouter le message initial (premier message) s'il n'est pas déjà dans l'historique
      if (payload.message) {
        const hasInitialInHistory = messagesHistory.some(
          (m: { content: string }) => m.content === payload.message && messagesHistory.length === 0
        );
        
        if (!hasInitialInHistory || messagesHistory.length === 0) {
          clientHistoryMessages.push({
            id: `${clientSignal.id}_initial`,
            created_at: clientSignal.created_at,
            agent_email: "CLIENT",
            content: payload.message,
            dossier_ref: clientSignal.dossier_ref,
            document_url: null,
            is_initial: true
          });
        }
      }
      
      // Ajouter tous les messages de l'historique
      messagesHistory.forEach((msg: { content: string; created_at: string }, index: number) => {
        clientHistoryMessages.push({
          id: `${clientSignal.id}_history_${index}`,
          created_at: msg.created_at,
          agent_email: "CLIENT",
          content: msg.content,
          dossier_ref: clientSignal.dossier_ref,
          document_url: null,
          is_initial: false
        });
      });
    }

    // 5. Rechercher les dossiers liés
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

    // 6. Formater les réponses staff
    const staffHistory = (replies || []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      agent_email: r.agent_email,
      content: r.content,
      dossier_ref: r.dossier_ref,
      document_url: r.document_url || null,
      is_initial: false
    }));

    // 7. Fusionner et trier par date (du plus récent au plus ancien)
    const allMessages = [...clientHistoryMessages, ...staffHistory];
    allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`✅ history: ${allMessages.length} messages au total pour ${dossierRef}`);

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
