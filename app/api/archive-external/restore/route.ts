
import { NextResponse } from "next/server";
import { getStationConfig, createDynamicClient } from "@/lib/supabase/master";

/**
 * API RESTORE : Restaure un dossier depuis GitHub vers la base STAFF
 * POST /api/archive-external/restore
 * Body: { dossier_ref: string, city_code: string, country_code?: string }
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

    // 1. Récupérer la configuration de la ville
    const config = await getStationConfig(effectiveCity, effectiveCountry);
    if (!config) {
      console.error(`❌ RESTORE: configuration introuvable pour ${effectiveCity}/${effectiveCountry}`);
      return NextResponse.json({ error: "Configuration ville introuvable" }, { status: 404 });
    }

    const targetRepo = config.github_repo;
    const customToken = config.github_token;

    if (!targetRepo || !customToken) {
      console.error(`❌ RESTORE: configuration GitHub manquante pour ${effectiveCity}/${effectiveCountry}`);
      return NextResponse.json({ error: "Configuration GitHub manquante" }, { status: 500 });
    }

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

    // 4. Lire le contenu de l'archive
    const fileRes = await fetch(targetFile.download_url);
    const archiveData = await fileRes.json();
    const restoredData = mapArchiveToFrontendShape(archiveData);

    if (!restoredData || !restoredData.dossier) {
      console.error(`❌ RESTORE: structure d'archive invalide pour ${dossier_ref}`);
      return NextResponse.json({ error: "Structure d'archive invalide" }, { status: 500 });
    }

    const signalData = restoredData.dossier;
    const historyData = restoredData.echanges_staff || [];

    console.log(`📦 RESTORE: archive lue, ${historyData.length} échanges trouvés`);

    // 5. Client STAFF pour la ville
    const staffClient = await createDynamicClient(effectiveCity, effectiveCountry, 'STAFF');

    // 6. Vérifier si le dossier existe déjà en base
    const { data: existingSignal, error: checkError } = await staffClient
      .from("pending_signals")
      .select("dossier_ref")
      .eq("dossier_ref", dossier_ref)
      .maybeSingle();

    if (checkError) {
      console.warn(`⚠️ RESTORE: erreur vérification existence:`, checkError);
    }

    if (existingSignal) {
      console.log(`ℹ️ RESTORE: le dossier ${dossier_ref} existe déjà en base, mise à jour uniquement de l'historique`);
    } else {
      // ✅ CORRECTION : is_new_athlete retiré du payload et mis à false par défaut
      const insertData = {
        id: signalData.id,
        dossier_ref: dossier_ref,
        payload: signalData.payload,
        confirmed: signalData.confirmed,
        is_read: true, // Important : apparaît dans l'onglet ARCHIVES
        is_new_athlete: false,
        created_at: signalData.created_at
      };

      const { error: insertError } = await staffClient
        .from("pending_signals")
        .insert([insertData]);

      if (insertError) {
        console.error(`❌ RESTORE: erreur insertion pending_signals:`, insertError);
        return NextResponse.json({ error: "Erreur insertion signal" }, { status: 500 });
      }

      console.log(`✅ RESTORE: signal inséré pour ${dossier_ref}`);
    }

    // 7. Insérer l'historique des échanges dans communication_replies
    if (historyData.length > 0) {
      const historyToInsert = historyData.map(h => ({
        id: h.id,
        dossier_ref: dossier_ref,
        agent_email: h.agent_email,
        content: h.content,
        document_url: h.document_url || null,
        created_at: h.created_at
      }));

      const { error: historyError } = await staffClient
        .from("communication_replies")
        .insert(historyToInsert);

      if (historyError) {
        console.error(`❌ RESTORE: erreur insertion historique:`, historyError);
        // Non bloquant, on continue
      } else {
        console.log(`✅ RESTORE: ${historyData.length} échanges insérés pour ${dossier_ref}`);
      }
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
