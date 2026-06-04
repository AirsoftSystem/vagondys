
// app/api/archive-external/find-by-email/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * API FIND BY EMAIL : Recherche le dossier_ref associé à un email dans les archives GitHub
 * POST /api/archive-external/find-by-email
 * Body: { email: string, country?: string }
 * 
 * Retourne le dossier_ref trouvé ou null
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

    // Pour chaque fichier, extraire l'email depuis le nom
    const emailMatches: Array<{ dossier_ref: string; filePath: string }> = [];

    for (const file of countryFiles) {
      const fileName = file.name;
      // Format attendu: {email_slug}_{dossier_ref}.json ou .json.gz
      const parts = fileName.replace(/\.json(\.gz)?$/, "").split("_");
      
      if (parts.length >= 2) {
        const emailSlug = parts[0];
        const dossierRef = parts.slice(1).join("_");
        
        // Reconstruire l'email depuis le slug
        const extractedEmail = emailSlug.replace(/_/g, "@");
        
        if (extractedEmail === normalizedEmail) {
          emailMatches.push({ dossier_ref: dossierRef, filePath: file.path });
        }
      }
    }

    if (emailMatches.length === 0) {
      return NextResponse.json({ dossier_ref: null, message: "Aucun dossier trouvé" });
    }

    // Retourner le premier dossier trouvé (le plus récent est prioritaire via le tri des fichiers)
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
