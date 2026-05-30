
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
  fil_de_discussion?: unknown[];
  date_archivage?: string;
  archive_by?: string;
  security_version?: string;
}

/**
 * API RESTORE : Restaure un dossier depuis GitHub vers la base STAFF
 * POST /api/archive-external/restore
 * Body: { dossier_ref: string, city_code: string, country_code?: string }
 * Version adaptée pour l'Option B (un seul projet Supabase + un seul repo GitHub)
 * ✅ AJOUT : Support des fichiers compressés .json.gz
 * ✅ CORRECTION : Fusion des messages existants au lieu d'ignorer
 * ✅ CORRECTION : Détection des doublons par id au lieu de content
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

    console.log(`📦 RESTORE: archive lue, ${historyData.length} échanges trouvés`);

    // 5. Client UNIQUE (Option B)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error(`❌ RESTORE: configuration Supabase manquante`);
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }
    
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 6. Vérifier si le dossier existe déjà en base (inclure is_read dans la sélection)
    const { data: existingSignal, error: checkError } = await supabaseClient
      .from("pending_signals")
      .select("payload, dossier_ref, is_read")
      .eq("dossier_ref", dossier_ref)
      .maybeSingle();

    if (checkError) {
      console.warn(`⚠️ RESTORE: erreur vérification existence:`, checkError);
    }

    if (existingSignal) {
      // ✅ CORRECTION : FUSIONNER l'historique des messages au lieu de ne rien faire
      console.log(`ℹ️ RESTORE: le dossier ${dossier_ref} existe déjà en base, fusion de l'historique`);
      
      // Récupérer les messages existants (depuis le payload existant)
      const existingPayload = existingSignal.payload as SignalPayload || {};
      const existingMessages = existingPayload.messages_history || [];
      
      // Récupérer les messages depuis l'archive brute (plus fiable que signalData.payload)
      const archivePayload = archiveData.dossier_complet?.payload || {};
      const newMessages = archivePayload.messages_history || [];
      
      // Fusion unique par date + contenu (évite les doublons)
      const messageMap = new Map<string, { content: string; created_at: string }>();
      
      // Ajouter les messages existants
      existingMessages.forEach((msg: { content: string; created_at: string }) => {
        const key = `${msg.created_at}_${msg.content.substring(0, 100)}`;
        if (!messageMap.has(key)) {
          messageMap.set(key, msg);
        }
      });
      
      // Ajouter les nouveaux messages (s'ils n'existent pas déjà)
      newMessages.forEach((msg: { content: string; created_at: string }) => {
        const key = `${msg.created_at}_${msg.content.substring(0, 100)}`;
        if (!messageMap.has(key)) {
          messageMap.set(key, msg);
        }
      });
      
      // Convertir en tableau et trier par date (croissant)
      const mergedMessages = Array.from(messageMap.values());
      mergedMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      console.log(`📦 RESTORE: fusion des messages - existants: ${existingMessages.length}, nouveaux: ${newMessages.length}, total: ${mergedMessages.length}`);
      
      // Construire le payload fusionné
      const currentPayload = existingPayload;
      const updatedPayload: SignalPayload = {
        ...currentPayload,
        messages_history: mergedMessages,
        // Conserver le message le plus récent comme message principal
        message: mergedMessages.length > 0 ? mergedMessages[mergedMessages.length - 1].content : (currentPayload.message || archivePayload.message)
      };
      
      const { error: updateError } = await supabaseClient
        .from("pending_signals")
        .update({
          payload: updatedPayload
        })
        .eq("dossier_ref", dossier_ref);
      
      if (updateError) {
        console.error(`❌ RESTORE: erreur mise à jour pending_signals:`, updateError);
      } else {
        console.log(`✅ RESTORE: signal mis à jour avec historique fusionné pour ${dossier_ref}`);
      }
      
    } else {
      // Insertion du signal restauré (première fois)
      const insertData = {
        id: signalData.id,
        dossier_ref: dossier_ref,
        payload: signalData.payload,
        confirmed: signalData.confirmed,
        is_read: true,
        is_new_athlete: false,
        created_at: signalData.created_at,
        city: effectiveCity,
        country: effectiveCountry
      };

      const { error: insertError } = await supabaseClient
        .from("pending_signals")
        .insert([insertData]);

      if (insertError) {
        console.error(`❌ RESTORE: erreur insertion pending_signals:`, insertError);
        return NextResponse.json({ error: "Erreur insertion signal" }, { status: 500 });
      }

      console.log(`✅ RESTORE: signal inséré pour ${dossier_ref}`);
    }

    // ✅ CORRECTION : Insérer l'historique des échanges en vérifiant par ID (plus fiable que par contenu)
    if (historyData.length > 0) {
      console.log(`📝 RESTORE: vérification et insertion de ${historyData.length} échanges dans communication_replies`);
      
      let insertedCount = 0;
      let duplicateCount = 0;
      
      for (const h of historyData) {
        // ✅ Vérifier si ce message existe déjà PAR ID (le plus fiable)
        const { data: existingById, error: checkByIdError } = await supabaseClient
          .from("communication_replies")
          .select("id")
          .eq("id", h.id)
          .maybeSingle();
        
        if (checkByIdError) {
          console.warn(`⚠️ RESTORE: erreur vérification par ID:`, checkByIdError);
        }
        
        if (existingById) {
          duplicateCount++;
          console.log(`⚠️ RESTORE: message déjà existant (ID ${h.id}), ignoré`);
          continue;
        }
        
        // Fallback: vérifier par contenu + date si l'ID n'existe pas
        const { data: existingByContent, error: checkContentError } = await supabaseClient
          .from("communication_replies")
          .select("id")
          .eq("dossier_ref", dossier_ref)
          .eq("agent_email", h.agent_email)
          .eq("created_at", h.created_at)
          .maybeSingle();
        
        if (checkContentError) {
          console.warn(`⚠️ RESTORE: erreur vérification par contenu:`, checkContentError);
        }
        
        if (existingByContent) {
          duplicateCount++;
          console.log(`⚠️ RESTORE: message déjà existant (même date/contenu), ignoré`);
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
        
        if (insertReplyError) {
          console.error(`❌ RESTORE: erreur insertion message:`, insertReplyError);
        } else {
          insertedCount++;
          console.log(`✅ RESTORE: message inséré (ID ${h.id})`);
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
