
// app/api/archive-external/find-by-email/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * API FIND BY EMAIL : Recherche le dossier_ref associé à un email dans les archives GitHub
 * GET /api/archive-external/find-by-email?search=email_slug
 * POST /api/archive-external/find-by-email
 * Body: { email: string, country?: string }
 * 
 * Retourne le dossier_ref trouvé ou null
 * 
 * ✅ CORRECTION : Recherche plus souple (normalisation + correspondance partielle)
 * ✅ NOUVELLE CORRECTION : Utilisation de findDossierRefByEmail() depuis engine.ts
 * ✅ NOUVELLE CORRECTION : Support des fichiers compressés et recherche dans le contenu
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

    // ✅ NOUVELLE CORRECTION : Utiliser la fonction dédiée de engine.ts
    const { findDossierRefByEmail } = await import("@/lib/archive-external/engine");
    
    // Recherche par contenu (plus fiable que la recherche par nom de fichier)
    let dossierRef = await findDossierRefByEmail(normalizedEmail, customToken, targetRepo);
    
    // ✅ Fallback : Recherche par nom de fichier si la recherche par contenu n'a rien trouvé
    if (!dossierRef) {
      console.log(`ℹ️ find-by-email: recherche par contenu sans résultat, fallback sur recherche par nom de fichier`);
      
      const { listAllArchiveFiles } = await import("@/lib/archive-external/gh-client");
      
      const countryPath = targetCountry === "ES" ? "ESPAGNE" : "FRANCE";
      
      // Récupérer tous les fichiers d'archives
      const allFiles = await listAllArchiveFiles(customToken, targetRepo, "archives");
      
      // Filtrer par pays (basé sur le chemin du fichier)
      const countryFiles = allFiles.filter(file => 
        file.path.toLowerCase().includes(countryPath.toLowerCase())
      );
      
      console.log(`📦 find-by-email: ${countryFiles.length} fichiers trouvés dans ${countryPath}`);
      
      const emailMatches: Array<{ dossier_ref: string; filePath: string; score: number }> = [];
      
      for (const file of countryFiles) {
        const fileName = file.name;
        const baseName = fileName.replace(/\.json(\.gz)?$/, "");
        
        // Recherche par correspondance normale
        const slugFromFile = baseName;
        const dossierRefMatch = slugFromFile.match(/(VGD-[A-Z0-9]+)/);
        const foundDossierRef = dossierRefMatch ? dossierRefMatch[1] : null;
        
        if (!foundDossierRef) continue;
        
        // ✅ Normalisation améliorée : gérer les points dans les emails Gmail
        // Exemple: airsoft.system.au@gmail.com → airsoftsystemau_gmail_com
        const normalizedEmailForMatch = normalizedEmail
          .replace(/\./g, "")      // Supprimer les points
          .replace(/@/g, "_")      // Remplacer @ par _
          .replace(/\./g, "");     // Supprimer les points résiduels
        
        const slugForMatch = slugFromFile.toLowerCase();
        
        if (slugForMatch.includes(normalizedEmailForMatch)) {
          emailMatches.push({ 
            dossier_ref: foundDossierRef, 
            filePath: file.path,
            score: 100
          });
          continue;
        }
        
        // Fallback : supprimer les tirets et essayer à nouveau
        const cleanSlug = slugForMatch.replace(/-/g, "");
        if (cleanSlug.includes(normalizedEmailForMatch.replace(/-/g, ""))) {
          emailMatches.push({ 
            dossier_ref: foundDossierRef, 
            filePath: file.path,
            score: 80
          });
        }
      }
      
      if (emailMatches.length > 0) {
        emailMatches.sort((a, b) => b.score - a.score);
        dossierRef = emailMatches[0].dossier_ref;
        console.log(`✅ find-by-email (fallback): dossier trouvé ${dossierRef} (score: ${emailMatches[0].score})`);
      }
    }

    if (!dossierRef) {
      console.log(`❌ find-by-email: aucun dossier trouvé pour ${normalizedEmail}`);
      return NextResponse.json({ dossier_ref: null, message: "Aucun dossier trouvé" });
    }

    console.log(`✅ find-by-email: dossier trouvé ${dossierRef}`);

    return NextResponse.json({
      dossier_ref: dossierRef,
      message: "Dossier trouvé"
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

/**
 * ✅ VERSION GET pour supporter les requêtes avec paramètre ?search=
 * GET /api/archive-external/find-by-email?search=email_slug
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchParam = searchParams.get("search");
    
    if (!searchParam) {
      return NextResponse.json(
        { error: "Paramètre 'search' requis" },
        { status: 400 }
      );
    }
    
    // Reconstruire l'email à partir du slug
    // Format: nom_prenom_gmail_com → nom.prenom@gmail.com
    let reconstructedEmail = searchParam.replace(/_/g, ".");
    reconstructedEmail = reconstructedEmail.replace(/\.com$/, "@gmail.com");
    reconstructedEmail = reconstructedEmail.replace(/\.fr$/, "@gmail.fr");
    
    // Si le slug contient "gmail", c'est un email Gmail
    if (searchParam.includes("gmail")) {
      const parts = searchParam.split("_");
      const localPart = parts.slice(0, -2).join("."); // les parties avant gmail et com
      reconstructedEmail = `${localPart}@gmail.com`;
    }
    
    console.log(`🔍 find-by-email GET: search=${searchParam} → email=${reconstructedEmail}`);
    
    // Créer une requête POST simulée
    const mockRequest = {
      json: async () => ({ email: reconstructedEmail })
    } as NextRequest;
    
    return await POST(mockRequest);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("❌ Erreur find-by-email GET:", errorMessage);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
