
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
 * Nettoie un objet en supprimant les champs avec valeur undefined
 * (nécessaire pour l'insertion JSONB dans Supabase)
 */
function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result as T;
}

/**
 * API RESTORE : Restaure un dossier depuis GitHub vers la base STAFF
 * POST /api/archive-external/restore
 * Body: { dossier_ref: string, city_code: string, country_code?: string }
 * Version adaptée pour l'Option B (un seul projet Supabase + un seul repo GitHub)
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

    // ✅ Récupérer directement l'historique complet depuis l'archive brute
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
    // SECTION : UPSERT pour pending_signals
    // ✅ CORRECTION : Nettoyage du payload pour éviter undefined
    // ==========================================================
    
    // Récupérer les informations depuis l'archive brute et signalData
    const archiveName = archivePayload.name || signalData.payload?.name;
    const archiveEmail = archivePayload.email || signalData.payload?.email;
    const archivePhone = archivePayload.phone || (signalData.payload?.phone === null ? undefined : signalData.payload?.phone);
    const archiveSubject = archivePayload.subject || signalData.payload?.subject;
    const archiveMessage = archivePayload.message || signalData.payload?.message;
    const archiveOriginalSubject = archivePayload.original_subject;
    const archiveConfirmedAt = archivePayload.confirmed_at;
    const archiveMeta = archivePayload.meta || {
      is_resurrected: true,
      is_returning_client: false,
      first_contact: false
    };
    
    // Construire le payload complet avec l'historique depuis l'archive brute
    const completePayload: SignalPayload = cleanUndefined({
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
    });
    
    const insertData = {
      dossier_ref: dossier_ref,
      payload: completePayload,
      confirmed: signalData.confirmed ?? false,
      is_read: true,
      is_new_athlete: false,
      created_at: archiveCreatedAt,
      city: effectiveCity,
      country: effectiveCountry
    };

    const { error: pendingSignalsError } = await supabaseClient
      .from("pending_signals")
      .upsert(insertData, { onConflict: "dossier_ref" });

    if (pendingSignalsError) {
      console.error(`❌ RESTORE: erreur upsert pending_signals:`, pendingSignalsError);
      return NextResponse.json({ error: "Erreur insertion signal" }, { status: 500 });
    }
    console.log(`✅ RESTORE: pending_signals mis à jour pour ${dossier_ref}`);

    // ==========================================================
    // SECTION : UPSERT pour messagerie_accounts (avec vérification user_id)
    // ✅ CORRECTION : Utilisation de la table auth.users (service_role)
    // ==========================================================
    
    // Vérifier si l'utilisateur existe déjà dans auth.users
    let userId: string | null = null;
    const { data: existingUser, error: userFetchError } = await supabaseClient
      .from('auth.users')
      .select('id')
      .eq('email', archiveEmail)
      .maybeSingle();
    
    if (userFetchError) {
      console.warn(`⚠️ RESTORE: erreur lors de la recherche de l'utilisateur dans auth.users:`, userFetchError);
    }
    
    if (existingUser) {
      userId = existingUser.id;
      console.log(`✅ RESTORE: utilisateur existant trouvé dans Auth (${userId})`);
    } else {
      console.log(`ℹ️ RESTORE: aucun utilisateur auth trouvé pour ${archiveEmail}, messagerie_accounts créé sans user_id`);
    }
    
    const accountData = cleanUndefined({
      user_id: userId,
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
    });

    const { error: accountError } = await supabaseClient
      .from("messagerie_accounts")
      .upsert(accountData, { onConflict: "dossier_ref" });

    if (accountError) {
      console.error(`❌ RESTORE: erreur upsert messagerie_accounts:`, accountError);
    } else {
      console.log(`✅ RESTORE: messagerie_accounts mis à jour pour ${dossier_ref}`);
    }

    // ==========================================================
    // SECTION : UPSERT pour messagerie_conversations
    // ==========================================================
    
    let lastMessage = "Bienvenue sur la messagerie privée VAGONDYS";
    let lastMessageAt = archiveCreatedAt;
    
    if (archiveData.fil_de_discussion && Array.isArray(archiveData.fil_de_discussion) && archiveData.fil_de_discussion.length > 0) {
      const lastMsg = archiveData.fil_de_discussion[archiveData.fil_de_discussion.length - 1] as FilDiscussionMessage;
      if (lastMsg.content) {
        lastMessage = lastMsg.content.substring(0, 200);
        lastMessageAt = lastMsg.created_at || archiveCreatedAt;
      }
    }
    
    const conversationData = cleanUndefined({
      dossier_ref: dossier_ref,
      participant_email: archiveEmail,
      participant_name: archiveName,
      participant_company: archivePayload.company || null,
      last_message: lastMessage,
      last_message_at: lastMessageAt,
      created_at: archiveCreatedAt,
      updated_at: new Date().toISOString()
    });

    const { error: conversationError } = await supabaseClient
      .from("messagerie_conversations")
      .upsert(conversationData, { onConflict: "dossier_ref" });

    if (conversationError) {
      console.error(`❌ RESTORE: erreur upsert messagerie_conversations:`, conversationError);
    } else {
      console.log(`✅ RESTORE: messagerie_conversations mis à jour pour ${dossier_ref}`);
    }

    // ==========================================================
    // SECTION : UPSERT pour messagerie_messages
    // ==========================================================
    
    const { data: convData } = await supabaseClient
      .from("messagerie_conversations")
      .select("id")
      .eq("dossier_ref", dossier_ref)
      .maybeSingle();
    
    let conversationId: string;
    if (convData) {
      conversationId = convData.id;
    } else {
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
      } else {
        console.log(`✅ RESTORE: conversation créée avec ID ${conversationId}`);
      }
    }
    
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
      let messagesInserted = 0;
      for (const msg of messagesToInsert) {
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
    // SECTION : UPSERT pour pending_messagerie_requests
    // ==========================================================
    
    const messagerieRequestData = cleanUndefined({
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
    });

    const { error: messagerieRequestError } = await supabaseClient
      .from("pending_messagerie_requests")
      .upsert(messagerieRequestData, { onConflict: "dossier_ref" });

    if (messagerieRequestError) {
      console.error(`❌ RESTORE: erreur upsert pending_messagerie_requests:`, messagerieRequestError);
    } else {
      console.log(`✅ RESTORE: pending_messagerie_requests mis à jour pour ${dossier_ref}`);
    }

    // ==========================================================
    // SECTION : communication_replies
    // ==========================================================
    
    if (historyData.length > 0) {
      console.log(`📝 RESTORE: vérification et insertion de ${historyData.length} échanges dans communication_replies`);
      
      let insertedCount = 0;
      let duplicateCount = 0;
      
      for (const h of historyData) {
        const { data: existingById } = await supabaseClient
          .from("communication_replies")
          .select("id")
          .eq("id", h.id)
          .maybeSingle();
        
        if (existingById) {
          duplicateCount++;
          continue;
        }
        
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
