
import { NextResponse } from "next/server";

const DEFAULT_REPO_NAME = "VAGONDYS_ARCHIVES_DATA";

/**
 * GET : Récupération ou Recherche
 * Version adaptée pour l'Option B (un seul repo GitHub)
 */
export async function GET(req: Request) {
  try {
    // ✅ Import dynamique - UNIQUEMENT les modules qui existent
    const { 
      listAllArchiveFiles, 
      findFileInRepo 
    } = await import("@/lib/archive-external/gh-client");
    const { 
      mapArchiveToFrontendShape, 
      getPathString 
    } = await import("@/lib/archive-external/utils");
    
    // ✅ Import de db-client pour la recherche en base
    const { findActiveSignalByEmail } = await import("@/lib/archive-external/db-client");

    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref");
    const searchEmail = searchParams.get("search");
    const filterCity = searchParams.get("city");
    const cityCode = searchParams.get("city_code");
    const countryCode = searchParams.get("country_code") || 'FR';

    // ✅ Option B : Un seul repo GitHub pour toutes les archives
    const targetRepo = process.env.GITHUB_ARCHIVE_REPO || DEFAULT_REPO_NAME;
    const customToken = process.env.GITHUB_ARCHIVE_TOKEN;

    const effectiveCity = cityCode || filterCity;
    
    console.log(`🔍 GET archive-external: ref=${ref}, search=${searchEmail}, city=${effectiveCity}, country=${countryCode}`);
    console.log(`🔍 GET archive-external: utilisation du repo unique="${targetRepo}"`);

    if (!customToken) {
      console.error("❌ GITHUB_ARCHIVE_TOKEN manquant");
      return NextResponse.json({ error: "Configuration GitHub manquante" }, { status: 500 });
    }

    // --- RECHERCHE PAR VILLE ---
    if (filterCity) {
      const files = await listAllArchiveFiles(customToken, targetRepo);
      const results = [];

      for (const file of files) {
        try {
          const fileRes = await fetch(file.download_url);
          if (!fileRes.ok) continue;
          const contentJson = await fileRes.json();
          
          const city = getPathString(contentJson, ["dossier_complet", "payload", "city"]) || 
                       getPathString(contentJson, ["dossier", "payload", "city"]);

          if (city?.toLowerCase() === filterCity.toLowerCase()) {
            results.push(mapArchiveToFrontendShape(contentJson));
          }
        } catch { continue; }
      }

      results.sort((a, b) => {
        const nameA = a.dossier.payload.pseudo || a.dossier.payload.name || "";
        const nameB = b.dossier.payload.pseudo || b.dossier.payload.name || "";
        return nameA.localeCompare(nameB);
      });

      return NextResponse.json(results);
    }

    // --- RECHERCHE PAR EMAIL ---
    if (searchEmail) {
      // ✅ Recherche en base avant GitHub
      console.log(`🔍 GET archive-external: recherche en base pour ${searchEmail}`);
      
      try {
        const activeSignal = await findActiveSignalByEmail(searchEmail, effectiveCity || undefined);
        if (activeSignal?.dossier_ref) {
          console.log(`✅ GET archive-external: dossier trouvé en base: ${activeSignal.dossier_ref}`);
          return NextResponse.json({ dossier_ref: activeSignal.dossier_ref });
        }
      } catch (dbErr) {
        console.warn(`⚠️ GET archive-external: erreur recherche base:`, dbErr);
      }
      
      // Recherche GitHub
      const files = await listAllArchiveFiles(customToken, targetRepo);
      const searchSlug = String(searchEmail).toLowerCase().replace(/[@.]/g, "_");
      const emailToMatch = String(searchEmail).replace(/_/g, ".").replace(/\.([^.]+)$/, "@$1");

      const recentFiles = files.slice(-200).reverse();
      for (const file of recentFiles) {
        try {
          if (String(file.name).toLowerCase().includes(searchSlug)) {
            const refMatch = String(file.name).match(/VGD-[A-Z0-9]{8}/i) || String(file.name).match(/VGD-[A-Z0-9]+/i);
            if (refMatch) return NextResponse.json({ dossier_ref: refMatch[0] });
          }
          
          const fileRes = await fetch(file.download_url);
          if (!fileRes.ok) continue;
          const contentJson = await fileRes.json();

          const fileEmail = getPathString(contentJson, ["dossier_complet", "payload", "email"]) ||
                            getPathString(contentJson, ["client_identity", "email"]) ||
                            getPathString(contentJson, ["dossier", "payload", "email"]);

          if (fileEmail) {
            const normFileEmail = String(fileEmail).toLowerCase();
            if (normFileEmail === emailToMatch.toLowerCase() || 
                normFileEmail.replace(/[@.]/g, "_") === searchSlug ||
                normFileEmail === searchEmail.toLowerCase()) {
              const foundRef = getPathString(contentJson, ["reference"]) ||
                               getPathString(contentJson, ["dossier_complet", "dossier_ref"]) ||
                               getPathString(contentJson, ["dossier", "dossier_ref"]);
              if (foundRef) return NextResponse.json({ dossier_ref: foundRef });
            }
          }
        } catch { continue; }
      }
      return NextResponse.json({ dossier_ref: null });
    }

    // --- RÉCUPÉRATION PAR RÉFÉRENCE ---
    if (!ref) return NextResponse.json({ error: "Référence manquante" }, { status: 400 });

    console.log(`🔍 GET archive-external: recherche fichier pour ref=${ref} dans repo=${targetRepo}`);
    
    const targetFile = await findFileInRepo(ref, customToken, targetRepo, "archives", countryCode);
    
    if (!targetFile) {
      console.warn(`❌ GET archive-external: fichier non trouvé pour ref=${ref}`);
      return NextResponse.json({ error: "Archive non trouvée" }, { status: 404 });
    }
    
    console.log(`✅ GET archive-external: fichier trouvé: ${targetFile.path}`);

    const fileRes = await fetch(targetFile.download_url);
    const contentJson = await fileRes.json();
    return NextResponse.json(mapArchiveToFrontendShape(contentJson));

  } catch (err: unknown) {
    console.error("Erreur API archive GET:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST : Archivage et Synchronisation
 * Version adaptée pour l'Option B (un seul repo GitHub)
 */
export async function POST(req: Request) {
  try {
    const { processArchivePost } = await import("@/lib/archive-external/engine");
    const { validateArchiveBody } = await import("@/lib/archive-external/validator");

    const body = await req.json();
    
    const { country_code } = body;
    console.log(`📦 POST archive-external: city_code=${body.city_code}, country_code=${country_code}`);

    const validation = validateArchiveBody(body);
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: "Données invalides", 
        details: validation.errors 
      }, { status: 400 });
    }

    const enrichedBody = {
      ...body,
      country_code: country_code
    };

    const result = await processArchivePost(enrichedBody);
    return NextResponse.json(result);

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur interne";
    console.error("❌ POST archive-external:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE : Suppression définitive
 * Version adaptée pour l'Option B (un seul repo GitHub)
 */
export async function DELETE(req: Request) {
  try {
    const { findFileInRepo, deleteFile } = await import("@/lib/archive-external/gh-client");

    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref");
    const countryCode = searchParams.get("country_code") || 'FR';

    if (!ref) return NextResponse.json({ error: "Référence manquante" }, { status: 400 });

    // ✅ Option B : Un seul repo GitHub
    const targetRepo = process.env.GITHUB_ARCHIVE_REPO || DEFAULT_REPO_NAME;
    const customToken = process.env.GITHUB_ARCHIVE_TOKEN;

    if (!customToken) {
      console.error("❌ GITHUB_ARCHIVE_TOKEN manquant");
      return NextResponse.json({ error: "Token de configuration manquant" }, { status: 500 });
    }

    console.log(`🗑️ DELETE archive-external: suppression ref=${ref} dans repo=${targetRepo}`);

    const targetFile = await findFileInRepo(ref, customToken, targetRepo, "archives", countryCode);
    if (!targetFile) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

    const deleteRes = await deleteFile(
      customToken, 
      targetRepo, 
      targetFile.path, 
      targetFile.sha, 
      `🗑️ SUPPRESSION DÉFINITIVE : Dossier ${ref}`
    );

    if (!deleteRes.ok) throw new Error("Échec de la suppression sur GitHub");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
