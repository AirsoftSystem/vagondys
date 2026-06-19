
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API de vérification des identifiants Admin (Master)
 * POST /api/admin/verify
 * Body: { email, password }
 * 
 * ✅ Vérifie les identifiants dans admin_config
 * ✅ Utilise la clé SERVICE_ROLE pour accéder à admin_config
 * ✅ Retourne { success: true } ou { error: "message" }
 * 
 * Sécurité :
 * - Seuls les emails autorisés sont acceptés (admin@vagondys.com, vagondys@gmail.com)
 * - Le mot de passe est stocké en clair dans admin_config (à améliorer avec bcrypt)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Récupération des paramètres
    const body = await request.json();
    const { email, password } = body;

    // 2. Validation des champs
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Vérifier que l'email est autorisé (admin uniquement)
    const allowedEmails = ["admin@vagondys.com", "vagondys@gmail.com"];
    if (!allowedEmails.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // 4. Connexion à Supabase avec SERVICE_ROLE
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ [admin/verify] Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 5. Récupérer le mot de passe admin depuis admin_config
    const { data: configData, error: configError } = await supabase
      .from("admin_config")
      .select("value")
      .eq("key", "admin_password")
      .maybeSingle();

    if (configError) {
      console.error("❌ [admin/verify] Erreur récupération admin_config:", configError);
      return NextResponse.json(
        { error: "Erreur lors de la vérification" },
        { status: 500 }
      );
    }

    if (!configData) {
      console.error("❌ [admin/verify] admin_password non trouvé dans admin_config");
      return NextResponse.json(
        { error: "Configuration admin manquante" },
        { status: 500 }
      );
    }

    const storedPassword = configData.value;

    // 6. Vérifier le mot de passe
    if (password !== storedPassword) {
      console.warn(`⚠️ [admin/verify] Tentative de connexion échouée pour ${normalizedEmail}`);
      return NextResponse.json(
        { error: "Mot de passe incorrect" },
        { status: 401 }
      );
    }

    // 7. Succès
    console.log(`✅ [admin/verify] Connexion admin réussie pour ${normalizedEmail}`);

    return NextResponse.json({
      success: true,
      message: "Connexion réussie",
      email: normalizedEmail,
    });

  } catch (error) {
    console.error("❌ [admin/verify] Erreur interne:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
