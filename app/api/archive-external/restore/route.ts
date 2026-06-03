
import { NextResponse } from "next/server";
import { gunzipSync } from 'zlib';

/**
 * Interface pour le payload d'un signal
 */
interface SignalPayload {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  subject?: string;
  message?: string;
  confirmed_at?: string;
  original_subject?: string;
  messages_history?: Array<{ content: string; created_at: string }>;
  meta?: {
    is_resurrected?: boolean;
    is_returning_client?: boolean;
    first_contact?: boolean;
    created_at?: string;
    last_update?: string;
  };
  [key: string]: unknown;
}

/**
 * Interface pour la structure de l'archive brute
 */
interface ArchiveDossierComplet {
  dossier_ref?: string;
  created_at?: string;
  payload?: SignalPayload;
  confirmed?: boolean;
  is_read?: boolean;
  is_new_athlete?: boolean;
  city?: string;
  country?: string;
  city_code?: string;
  country_code?: string;
  [key: string]: unknown;
}

interface RawArchiveData {
  dossier_complet?: ArchiveDossierComplet;
  reference?: string;
  client_identity?: {
    nom?: string;
    email?: string;
    telephone?: string;
    sujet?: string;
  };
  echanges_staff?: Array<{
    id: string;
    created_at: string;
    agent_email: string;
    content: string;
    document_url?: string | null;
    dossier_ref?: string;
  }>;
  fil_de_discussion?: FilDiscussionMessage[];
  date_archivage?: string;
  archive_by?: string;
  security_version?: string;
}

/**
 * Interface pour un message du fil de discussion
 */
interface FilDiscussionMessage {
  content?: string;
  created_at?: string;
  sender?: string;
  sender_name?: string;
  agent_email?: string;
  document_url?: string | null;
  file_url?: string | null;
  file_key?: string | null;
  [key: string]: unknown;
}

/**
 * Interface pour l'insertion d'un message dans messagerie_messages
 */
interface MessageToInsert {
  conversation_id: string;
  sender_email: string;
  sender_name: string;
  content: string;
  file_url: string | null;
  file_key: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * API RESTORE : Restaure un dossier depuis GitHub vers la base STAFF
 * POST /api/archive-external/restore
 * Body: { dossier_ref: string, city_code: string, country_code?: string }
 * Version adaptée pour l'Option B (un seul projet Supabase + un seul repo GitHub)
 * ✅ AJOUT : Support des fichiers compressés .json.gz
 * ✅ CORRECTION : Fusion des messages existants au lieu d'ignorer
 * ✅ CORRECTION : Détection des doublons par id au lieu de content
 * ✅ CORRECTION : Utilisation de l'archive brute pour l'historique complet
 * ✅ AJOUT : UPSERT complet pour toutes les tables (pending_signals, messagerie_accounts, messagerie_conversations, messagerie_messages)
 */
export async function POST(req: Request) {
  try {
    const { dossier_ref, city_code, country_code } = await req.json();

    if (!dossier_ref) {
      return NextResponse.json({ error: "Référence du dossier manquante" }, { status: 400 });
    }

    if (!city_code) {
      return NextResponse.json({ error: "Code ville manquant" }, { status: 400 });
    }

    const effectiveCity = city_code.toUpperCase().trim();
    const effectiveCountry = country_code?.toUpperCase().trim() || 'FR';

    console.log(`🔄 RESTORE: début restauration pour ${dossier_ref} (${effectiveCity}/${effectiveCountry})`);

    // ✅ Option B : Un seul repo GitHub
    const targetRepo = process.env.GITHUB_ARCHIVE_REPO;
    const customToken = process.env.GITHUB_ARCHIVE_TOKEN;

    if (!targetRepo) {
      console.error(`❌ RESTORE: GITHUB_ARCHIVE_REPO manquant`);
      return NextResponse.json({ error: "Configuration GitHub manquante (repo)" }, { status: 500 });
    }

    if (!customToken) {
      console.error(`❌ RESTORE: GITHUB_ARCHIVE_TOKEN manquant`);
      return NextResponse.json({ error: "Configuration GitHub manquante (token)" }, { status: 500 });
    }

    console.log(`🔍 RESTORE: utilisation du repo unique: ${targetRepo}`);

    // 2. Importer les fonctions nécessaires
    const { findFileInRepo } = await import("@/lib/archive-external/gh-client");
    const { mapArchiveToFrontendShape } = await import("@/lib/archive-external/utils");

    // 3. Rechercher l'archive sur GitHub
    console.log(`🔍 RESTORE: recherche de l'archive ${dossier_ref} dans ${targetRepo}`);
    const targetFile = await findFileInRepo(dossier_ref, customToken, targetRepo, "archives", effectiveCountry);

    if (!targetFile) {
      console.error(`❌ RESTORE: archive non trouvée pour ${dossier_ref}`);
      return NextResponse.json({ error: "Archive non trouvée sur GitHub" }, { status: 404 });
    }

    console.log(`✅ RESTORE: fichier trouvé: ${targetFile.name} (${targetFile.path})`);

    // 4. Lire le contenu de l'archive (avec décompression si nécessaire)
    const fileRes = await fetch(targetFile.download_url);
    
    let archiveData: RawArchiveData;
    const isGzipped = targetFile.name.endsWith('.gz');
    
    if (isGzipped) {
      const arrayBuffer = await fileRes.arrayBuffer();
      const decompressed = gunzipSync(Buffer.from(arrayBuffer));
      archiveData = JSON.parse(decompressed.toString('utf8')) as RawArchiveData;
      console.log(`📦 RESTORE: fichier GZIP décompressé (${targetFile.name})`);
    } else {
      archiveData = await fileRes.json() as RawArchiveData;
      console.log(`📦 RESTORE: fichier JSON standard (${targetFile.name})`);
    }
    
    const restoredData = mapArchiveToFrontendShape(archiveData as unknown as Record<string, unknown>);

    if (!restoredData || !restoredData.dossier) {
      console.error(`❌ RESTORE: structure d'archive invalide pour ${dossier_ref}`);
      return NextResponse.json({ error: "Structure d'archive invalide" }, { status: 500 });
    }

    const signalData = restoredData.dossier;
    const historyData = restoredData.echanges_staff || [];

    // ✅ CORRECTION : Récupérer directement l'historique complet depuis l'archive brute
    const archivePayload = archiveData.dossier_complet?.payload || {};
    const archiveMessagesHistory = archivePayload.messages_history || [];
    const archiveCreatedAt = archiveData.dossier_complet?.created_at || signalData.created_at;

    console.log(`📦 RESTORE: archive lue, ${historyData.length} échanges trouvés, ${archiveMessagesHistory.length} messages dans l'historique`);

    // 5. Client UNIQUE (Option B)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error(`❌ RESTORE: configuration Supabase manquante`);
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }
    
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // ==========================================================
    // ✅ NOUVELLE SECTION : UPSERT pour pending_signals
    // ==========================================================
    
    // Récupérer les informations depuis l'archive brute et signalData
    const archiveName = archivePayload.name || signalData.payload.name;
    const archiveEmail = archivePayload.email || signalData.payload.email;
    const archivePhone = archivePayload.phone || (signalData.payload.phone === null ? undefined : signalData.payload.phone);
    const archiveSubject = archivePayload.subject || signalData.payload.subject;
    const archiveMessage = archivePayload.message || signalData.payload.message;
    const archiveOriginalSubject = archivePayload.original_subject;
    const archiveConfirmedAt = archivePayload.confirmed_at;
    const archiveMeta = archivePayload.meta || {
      is_resurrected: true,
      is_returning_client: false,
      first_contact: false
    };
    
    // Construire le payload complet avec l'historique depuis l'archive brute
    const completePayload: SignalPayload = {
      name: archiveName,
      email: archiveEmail,
      phone: archivePhone,
      city: effectiveCity,
      country: effectiveCountry,
      subject: archiveSubject,
      message: archiveMessage,
      original_subject: archiveOriginalSubject,
      confirmed_at: archiveConfirmedAt,
      messages_history: archiveMessagesHistory,
      meta: archiveMeta
    };
    
    const insertData = {
      id: signalData.id,
      dossier_ref: dossier_ref,
      payload: completePayload,
      confirmed: signalData.confirmed,
      is_read: true,
      is_new_athlete: false,
      created_at: archiveCreatedAt,
      city: effectiveCity,
      country: effectiveCountry
    };

    // ✅ UPSERT dans pending_signals (au lieu de simple insert)
    const { error: pendingSignalsError } = await supabaseClient
      .from("pending_signals")
      .upsert(insertData, { onConflict: "dossier_ref" });

    if (pendingSignalsError) {
      console.error(`❌ RESTORE: erreur upsert pending_signals:`, pendingSignalsError);
      return NextResponse.json({ error: "Erreur insertion signal" }, { status: 500 });
    }
    console.log(`✅ RESTORE: pending_signals mis à jour pour ${dossier_ref}`);

    // ==========================================================
    // ✅ NOUVELLE SECTION : UPSERT pour messagerie_accounts
    // ==========================================================
    
    // Récupérer les informations du compte depuis l'archive
    const accountData = {
      user_id: signalData.id,
      email: archiveEmail,
      full_name: archiveName,
      company: archivePayload.company || null,
      phone: archivePhone || null,
      dossier_ref: dossier_ref,
      role: "partner",
      status: "active",
      created_at: archiveCreatedAt,
      updated_at: new Date().toISOString(),
      created_by: "system_restore"
    };

    const { error: accountError } = await supabaseClient
      .from("messagerie_accounts")
      .upsert(accountData, { onConflict: "dossier_ref" });

    if (accountError) {
      console.error(`❌ RESTORE: erreur upsert messagerie_accounts:`, accountError);
      // Non bloquant, on continue
    } else {
      console.log(`✅ RESTORE: messagerie_accounts mis à jour pour ${dossier_ref}`);
    }

    // ==========================================================
    // ✅ NOUVELLE SECTION : UPSERT pour messagerie_conversations
    // ==========================================================
    
    // Extraire le message de bienvenue du fil de discussion ou utiliser un message par défaut
    let lastMessage = "Bienvenue sur la messagerie privée VAGONDYS";
    let lastMessageAt = archiveCreatedAt;
    
    // Chercher le dernier message dans le fil de discussion
    if (archiveData.fil_de_discussion && Array.isArray(archiveData.fil_de_discussion) && archiveData.fil_de_discussion.length > 0) {
      const lastMsg = archiveData.fil_de_discussion[archiveData.fil_de_discussion.length - 1] as FilDiscussionMessage;
      if (lastMsg.content) {
        lastMessage = lastMsg.content.substring(0, 200);
        lastMessageAt = lastMsg.created_at || archiveCreatedAt;
      }
    }
    
    const conversationData = {
      dossier_ref: dossier_ref,
      participant_email: archiveEmail,
      participant_name: archiveName,
      participant_company: archivePayload.company || null,
      last_message: lastMessage,
      last_message_at: lastMessageAt,
      created_at: archiveCreatedAt,
      updated_at: new Date().toISOString()
    };

    const { error: conversationError } = await supabaseClient
      .from("messagerie_conversations")
      .upsert(conversationData, { onConflict: "dossier_ref" });

    if (conversationError) {
      console.error(`❌ RESTORE: erreur upsert messagerie_conversations:`, conversationError);
      // Non bloquant
    } else {
      console.log(`✅ RESTORE: messagerie_conversations mis à jour pour ${dossier_ref}`);
    }

    // ==========================================================
    // ✅ NOUVELLE SECTION : UPSERT pour messagerie_messages
    // ==========================================================
    
    // Récupérer l'ID de la conversation (ou le créer)
    const { data: convData } = await supabaseClient
      .from("messagerie_conversations")
      .select("id")
      .eq("dossier_ref", dossier_ref)
      .maybeSingle();
    
    let conversationId: string;
    if (convData) {
      conversationId = convData.id;
    } else {
      // Créer une nouvelle conversation avec un ID aléatoire
      conversationId = crypto.randomUUID();
      const { error: createConvError } = await supabaseClient
        .from("messagerie_conversations")
        .insert({
          id: conversationId,
          dossier_ref: dossier_ref,
          participant_email: archiveEmail,
          participant_name: archiveName,
          participant_company: archivePayload.company || null,
          created_at: archiveCreatedAt,
          updated_at: new Date().toISOString()
        });
      
      if (createConvError) {
        console.error(`❌ RESTORE: erreur création conversation:`, createConvError);
        // On continue quand même, mais on ne pourra pas insérer de messages
      } else {
        console.log(`✅ RESTORE: conversation créée avec ID ${conversationId}`);
      }
    }
    
    // Extraire les messages du fil de discussion (uniquement si conversationId existe)
    const messagesToInsert: MessageToInsert[] = [];
    
    if (archiveData.fil_de_discussion && Array.isArray(archiveData.fil_de_discussion) && conversationId) {
      for (const msg of archiveData.fil_de_discussion as FilDiscussionMessage[]) {
        if (msg.content && msg.created_at) {
          messagesToInsert.push({
            conversation_id: conversationId,
            sender_email: msg.sender === "SYSTEM" ? "system@vagondys.com" : (msg.sender || msg.agent_email || "unknown@vagondys.com"),
            sender_name: msg.sender === "SYSTEM" ? "Système VAGONDYS" : (msg.sender_name || msg.sender || "Utilisateur"),
            content: msg.content,
            file_url: msg.document_url || msg.file_url || null,
            file_key: msg.file_key || null,
            is_read: false,
            created_at: msg.created_at
          });
        }
      }
    }
    
    if (messagesToInsert.length > 0 && conversationId) {
      // Insérer les messages un par un pour éviter les doublons
      let messagesInserted = 0;
      for (const msg of messagesToInsert) {
        // Vérifier si le message existe déjà (par contenu + date)
        const { data: existingMsg } = await supabaseClient
          .from("messagerie_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("content", msg.content)
          .eq("created_at", msg.created_at)
          .maybeSingle();
        
        if (!existingMsg) {
          const { error: msgError } = await supabaseClient
            .from("messagerie_messages")
            .insert(msg);
          
          if (!msgError) {
            messagesInserted++;
          }
        }
      }
      console.log(`✅ RESTORE: ${messagesInserted} messages insérés dans messagerie_messages pour ${dossier_ref}`);
    } else if (!conversationId) {
      console.warn(`⚠️ RESTORE: impossible d'insérer les messages, conversationId manquant`);
    }

    // ==========================================================
    // ✅ NOUVELLE SECTION : UPSERT pour pending_messagerie_requests
    // ==========================================================
    
    // Récupérer les informations de la demande depuis l'archive
    const messagerieRequestData = {
      dossier_ref: dossier_ref,
      full_name: archiveName,
      email: archiveEmail,
      company: archivePayload.company || null,
      phone: archivePhone || null,
      reason: archiveMessage || "Demande de partenariat",
      status: "approved",
      reviewed_by: "system_restore",
      reviewed_at: archiveCreatedAt,
      created_at: archiveCreatedAt,
      updated_at: new Date().toISOString(),
      kbis_url: archivePayload.kbis_url || null,
      kbis_key: archivePayload.kbis_key || null,
      kbis_validated: archivePayload.kbis_validated || false,
      kbis_scan_result: archivePayload.kbis_scan_result || null
    };

    const { error: messagerieRequestError } = await supabaseClient
      .from("pending_messagerie_requests")
      .upsert(messagerieRequestData, { onConflict: "dossier_ref" });

    if (messagerieRequestError) {
      console.error(`❌ RESTORE: erreur upsert pending_messagerie_requests:`, messagerieRequestError);
      // Non bloquant
    } else {
      console.log(`✅ RESTORE: pending_messagerie_requests mis à jour pour ${dossier_ref}`);
    }

    // ==========================================================
    // SECTION EXISTANTE : communication_replies (conservée et améliorée)
    // ==========================================================
    
    if (historyData.length > 0) {
      console.log(`📝 RESTORE: vérification et insertion de ${historyData.length} échanges dans communication_replies`);
      
      let insertedCount = 0;
      let duplicateCount = 0;
      
      for (const h of historyData) {
        // ✅ Vérifier si ce message existe déjà PAR ID (le plus fiable)
        const { data: existingById } = await supabaseClient
          .from("communication_replies")
          .select("id")
          .eq("id", h.id)
          .maybeSingle();
        
        if (existingById) {
          duplicateCount++;
          continue;
        }
        
        // Fallback: vérifier par contenu + date si l'ID n'existe pas
        const { data: existingByContent } = await supabaseClient
          .from("communication_replies")
          .select("id")
          .eq("dossier_ref", dossier_ref)
          .eq("agent_email", h.agent_email)
          .eq("created_at", h.created_at)
          .maybeSingle();
        
        if (existingByContent) {
          duplicateCount++;
          continue;
        }
        
        // N'existe pas, on l'insère
        const replyData = {
          id: h.id,
          dossier_ref: dossier_ref,
          agent_email: h.agent_email,
          content: h.content,
          document_url: h.document_url || null,
          created_at: h.created_at,
          city: effectiveCity,
          country: effectiveCountry
        };
        
        const { error: insertReplyError } = await supabaseClient
          .from("communication_replies")
          .insert([replyData]);
        
        if (!insertReplyError) {
          insertedCount++;
        }
      }
      
      console.log(`✅ RESTORE: ${insertedCount} nouveaux échanges insérés, ${duplicateCount} doublons ignorés pour ${dossier_ref}`);
    }

    console.log(`✅ RESTORE: restauration terminée avec succès pour ${dossier_ref}`);

    return NextResponse.json({
      success: true,
      message: `Dossier ${dossier_ref} restauré avec succès`,
      restored: {
        dossier_ref: dossier_ref,
        messages_count: historyData.length
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("❌ RESTORE: erreur critique:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
