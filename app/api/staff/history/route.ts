
import { NextResponse } from "next/server";
import { getStaffCity } from "@/actions/staff-actions";

// ✅ Définition d'un type pour les messages du fullThread (évite 'any')
interface FullThreadMessage {
  role?: string;
  sender?: string;
  content?: string;
  created_at?: string;
  [key: string]: unknown;
}

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

    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // ✅ VÉRIFICATION CRITIQUE : Les variables doivent exister
    if (!supabaseUrl) {
      console.error("❌ history API: NEXT_PUBLIC_SUPABASE_URL manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    if (!supabaseServiceKey) {
      console.error("❌ history API: SUPABASE_SERVICE_ROLE_KEY manquante");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client ADMIN avec SERVICE_ROLE (côté serveur, créé à l'exécution)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const cityUpper = city.toUpperCase().trim();
    const countryUpper = country.toUpperCase().trim();

    console.log(`✅ history: client ADMIN créé pour ${cityUpper}/${countryUpper}`);

    // 1. Récupérer les réponses du staff
    const { data: replies, error: repliesError } = await adminClient
      .from("communication_replies")
      .select("*")
      .eq("dossier_ref", dossierRef)
      .order("created_at", { ascending: false });

    if (repliesError) {
      console.error("❌ history: erreur récupération replies:", repliesError);
    } else {
      console.log(`📦 history: ${replies?.length || 0} réponses staff trouvées pour dossier ${dossierRef}`);
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
      
      let oldestMessageDate: string | null = null;
      if (messagesHistory.length > 0) {
        const sortedMessages = [...messagesHistory].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        oldestMessageDate = sortedMessages[0]?.created_at || null;
      }
      
      if (payload.message) {
        const isAlreadyInHistory = messagesHistory.some(
          (m: { content: string }) => m.content === payload.message
        );
        
        if (messagesHistory.length === 0) {
          clientHistoryMessages.push({
            id: `${clientSignal.id}_initial`,
            created_at: clientSignal.created_at,
            agent_email: "CLIENT",
            content: payload.message,
            dossier_ref: clientSignal.dossier_ref,
            document_url: null,
            is_initial: true
          });
        } else if (!isAlreadyInHistory && oldestMessageDate) {
          clientHistoryMessages.push({
            id: `${clientSignal.id}_initial`,
            created_at: oldestMessageDate,
            agent_email: "CLIENT",
            content: payload.message,
            dossier_ref: clientSignal.dossier_ref,
            document_url: null,
            is_initial: true
          });
        }
      }
      
      messagesHistory.forEach((msg: { content: string; created_at: string }, index: number) => {
        const isDuplicateOfInitial = payload.message === msg.content && 
                                     clientHistoryMessages.some(m => m.content === msg.content);
        
        if (!isDuplicateOfInitial) {
          clientHistoryMessages.push({
            id: `${clientSignal.id}_history_${index}`,
            created_at: msg.created_at,
            agent_email: "CLIENT",
            content: msg.content,
            dossier_ref: clientSignal.dossier_ref,
            document_url: null,
            is_initial: false
          });
        }
      });
    }

    // ✅ 5. RÉCUPÉRATION DE L'ARCHIVE GITHUB (messages systèmes)
    const systemMessages: Array<{
      id: string;
      created_at: string;
      agent_email: string;
      content: string;
      dossier_ref: string;
      document_url: null;
      is_initial: boolean;
    }> = [];

    try {
      const { fetchGitHubArchive } = await import("@/lib/supabase/client");
      const archiveData = await fetchGitHubArchive(dossierRef, cityUpper, countryUpper);
      
      // ✅ Vérification de l'existence de fullThread dans archiveData
      if (archiveData && 'fullThread' in archiveData && Array.isArray((archiveData as { fullThread?: FullThreadMessage[] }).fullThread)) {
        const fullThread = (archiveData as { fullThread: FullThreadMessage[] }).fullThread;
        console.log(`📦 history: archive GitHub trouvée pour ${dossierRef} - ${fullThread.length} messages dans fullThread`);
        
        for (const msg of fullThread) {
          const role = msg.role;
          const sender = msg.sender;
          const content = msg.content;
          const createdAt = msg.created_at;
          
          if (!content || !createdAt) continue;
          
          // Identifier les messages système (role === "system" ou sender === "SYSTEM")
          const isSystemMessage = role === "system" || sender === "SYSTEM";
          
          if (isSystemMessage) {
            console.log(`📦 history: message système détecté - content: ${content.substring(0, 50)}...`);
            systemMessages.push({
              id: `system_${createdAt}_${content.substring(0, 20)}`,
              created_at: createdAt,
              agent_email: "SYSTEM",
              content: content,
              dossier_ref: dossierRef,
              document_url: null,
              is_initial: false
            });
          }
        }
      } else if (archiveData) {
        console.log(`📦 history: archive trouvée mais sans fullThread pour ${dossierRef}`);
      } else {
        console.log(`📦 history: aucune archive GitHub trouvée pour ${dossierRef}`);
      }
    } catch (archiveErr) {
      console.warn(`⚠️ history: erreur lors de la récupération de l'archive GitHub pour ${dossierRef}:`, archiveErr);
    }

    // 6. Rechercher les dossiers liés (avec filtre city)
    let linkedDossiers: string[] = [];
    if (clientEmail) {
      console.log(`🔗 history: recherche dossiers liés pour ${clientEmail}`);
      
      const { data: otherSignals, error: otherError } = await adminClient
        .from("pending_signals")
        .select("dossier_ref")
        .eq("payload->>email", clientEmail)
        .eq("city", cityUpper)
        .eq("country", countryUpper)
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
          .eq("city", cityUpper)
          .eq("country", countryUpper)
          .neq("dossier_ref", dossierRef)
          .not("dossier_ref", "is", null);

        if (!replyError && otherReplies) {
          const replyRefs = [...new Set(otherReplies.map(r => r.dossier_ref).filter(Boolean))];
          linkedDossiers = [...new Set([...linkedDossiers, ...replyRefs])];
          console.log(`🔗 history: ${replyRefs.length} dossiers liés trouvés dans replies`);
        }
      }
    }

    // 7. Formater les réponses staff
    const staffHistory = (replies || []).map(r => ({
      id: r.id,
      created_at: r.created_at,
      agent_email: r.agent_email,
      content: r.content,
      dossier_ref: r.dossier_ref,
      document_url: r.document_url || null,
      is_initial: false
    }));

    // 8. Fusionner et trier par date (du plus récent au plus ancien)
    const allMessages = [...clientHistoryMessages, ...staffHistory, ...systemMessages];
    allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`✅ history: ${allMessages.length} messages au total pour ${dossierRef} (dont ${staffHistory.length} staff, ${clientHistoryMessages.length} client, ${systemMessages.length} système)`);

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
