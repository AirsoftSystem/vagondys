
// app/api/archive-external/find-by-email/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * API FIND BY EMAIL : Recherche le dossier_ref associé à un email dans les archives GitHub
 * POST /api/archive-external/find-by-email
 * Body: { email: string, country?: string }
 * 
 * Retourne le dossier_ref trouvé ou null
 * 
 * ✅ CORRECTION : Recherche plus souple (normalisation + correspondance partielle)
 */
export async function POST(request: NextRequest) {
  try {
    const { email, country } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const targetCountry = country?.toUpperCase().trim() || "FR";
    const countryPath = targetCountry === "ES" ? "ESPAGNE" : "FRANCE";

    // Version normalisée de l'email pour la recherche (supprime les points et remplace @ par _)
    const emailForSearch = normalizedEmail.replace(/\./g, "").replace("@", "_");

    console.log(`🔍 find-by-email: recherche pour ${normalizedEmail} (slug: ${emailForSearch})`);

    // Configuration GitHub
    const targetRepo = process.env.GITHUB_ARCHIVE_REPO;
    const customToken = process.env.GITHUB_ARCHIVE_TOKEN;

    if (!targetRepo || !customToken) {
      console.error("❌ Configuration GitHub manquante");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    // Importer les fonctions nécessaires
    const { listAllArchiveFiles } = await import("@/lib/archive-external/gh-client");

    // Récupérer tous les fichiers d'archives
    const allFiles = await listAllArchiveFiles(customToken, targetRepo, "archives");

    // Filtrer par pays (basé sur le chemin du fichier)
    const countryFiles = allFiles.filter(file => 
      file.path.toLowerCase().includes(countryPath.toLowerCase())
    );

    console.log(`📦 find-by-email: ${countryFiles.length} fichiers trouvés dans ${countryPath}`);

    // Pour chaque fichier, extraire le dossier_ref
    const emailMatches: Array<{ dossier_ref: string; filePath: string; score: number }> = [];

    for (const file of countryFiles) {
      const fileName = file.name;
      const baseName = fileName.replace(/\.json(\.gz)?$/, "");
      
      // Recherche par correspondance normale
      const slugFromFile = baseName;
      const dossierRefMatch = slugFromFile.match(/(VGD-[A-Z0-9]+)/);
      const dossierRef = dossierRefMatch ? dossierRefMatch[1] : null;
      
      if (!dossierRef) continue;
      
      // Vérifier si le nom du fichier contient notre slug d'email
      if (slugFromFile.includes(emailForSearch)) {
        emailMatches.push({ 
          dossier_ref: dossierRef, 
          filePath: file.path,
          score: 100 // correspondance exacte
        });
        continue;
      }
      
      // Fallback : supprimer les tirets et essayer à nouveau
      const cleanSlug = slugFromFile.replace(/-/g, "");
      if (cleanSlug.includes(emailForSearch.replace(/-/g, ""))) {
        emailMatches.push({ 
          dossier_ref: dossierRef, 
          filePath: file.path,
          score: 80 // correspondance approximative
        });
      }
    }

    if (emailMatches.length === 0) {
      console.log(`❌ find-by-email: aucun dossier trouvé pour ${normalizedEmail}`);
      return NextResponse.json({ dossier_ref: null, message: "Aucun dossier trouvé" });
    }

    // Trier par score (le plus élevé d'abord) et prendre le premier
    emailMatches.sort((a, b) => b.score - a.score);
    
    console.log(`✅ find-by-email: dossier trouvé ${emailMatches[0].dossier_ref} (score: ${emailMatches[0].score})`);

    return NextResponse.json({
      dossier_ref: emailMatches[0].dossier_ref,
      count: emailMatches.length,
      message: `${emailMatches.length} dossier(s) trouvé(s)`
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("❌ Erreur find-by-email:", errorMessage);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
