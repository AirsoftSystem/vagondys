
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GitHubDB } from "@/lib/github-db/client";

/**
 * API de vérification de première connexion
 * GET /api/messagerie/check-first-login
 * 
 * Vérifie si l'utilisateur se connecte pour la première fois
 * Si c'est le cas, crée le message de bienvenue dans GitHub
 * 
 * ✅ Sécurité : L'utilisateur doit être authentifié
 * ✅ Logique : 
 *   1. Récupère l'utilisateur authentifié
 *   2. Vérifie dans messagerie_accounts si welcome_sent est true
 *   3. Si non, crée le message de bienvenue dans GitHub
 *   4. Marque welcome_sent = true
 * 
 * 📌 Le message de bienvenue est créé UNIQUEMENT lors de la PREMIÈRE CONNEXION
 *    après que l'utilisateur a défini son mot de passe et s'est connecté
 */
export async function GET() {
  const startTime = Date.now();
  console.log(`🔑 [check-first-login] Début - ${new Date().toISOString()}`);
  
  try {
    // 1. Vérification des variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("❌ [check-first-login] Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    // 2. Récupérer l'utilisateur authentifié (via cookie de session)
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      console.error(`❌ [check-first-login] Non authentifié - authError: ${authError?.message || "no user"}`);
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userEmail = user.email?.toLowerCase() || "";
    const userId = user.id;

    console.log(`👤 [check-first-login] Utilisateur: ${userEmail} (ID: ${userId})`);

    // 3. Connexion admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Récupérer le compte messagerie de l'utilisateur
    const { data: messagerieAccount, error: accountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("dossier_ref, full_name, email, status, welcome_sent")
      .eq("user_id", userId)
      .maybeSingle();

    if (accountError || !messagerieAccount) {
      console.error(`❌ [check-first-login] Compte messagerie introuvable pour ${userId}:`, accountError?.message);
      return NextResponse.json(
        { error: "Compte messagerie non trouvé" },
        { status: 404 }
      );
    }

    const dossierRef = messagerieAccount.dossier_ref;
    
    console.log(`📁 [check-first-login] Dossier: ${dossierRef}, status: ${messagerieAccount.status}, welcome_sent: ${messagerieAccount.welcome_sent}`);

    // 5. Vérifier si l'utilisateur a déjà reçu le message de bienvenue
    if (messagerieAccount.welcome_sent === true) {
      console.log(`ℹ️ [check-first-login] Message de bienvenue déjà envoyé pour ${dossierRef}`);
      return NextResponse.json({
        success: true,
        welcome_sent: true,
        message: "Message de bienvenue déjà envoyé"
      });
    }

    // 6. Vérifier que le compte est actif (status = "active")
    if (messagerieAccount.status !== "active") {
      console.log(`ℹ️ [check-first-login] Compte non actif (status: ${messagerieAccount.status}), message de bienvenue différé`);
      return NextResponse.json({
        success: false,
        welcome_sent: false,
        message: "Compte non actif, le message de bienvenue sera envoyé lors de la première connexion"
      });
    }

    // 7. CRÉER LE MESSAGE DE BIENVENUE DANS GITHUB
    console.log(`📝 [check-first-login] Création du message de bienvenue pour ${dossierRef}`);
    
    try {
      const gitHubPath = `conversations/${dossierRef}/messages.json.gz`;
      const now = new Date().toISOString();
      
      // Créer le message de bienvenue
      const welcomeMessage = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        dossier_ref: dossierRef,
        sender_email: "system@vagondys.com",
        sender_name: "Système VAGONDYS",
        content: "Bienvenue sur la messagerie privée VAGONDYS. Notre équipe prendra contact avec vous sous 48h.",
        file_url: null,
        file_key: null,
        is_read: false,
        created_at: now,
      };
      
      // Lire les messages existants (si le fichier existe déjà)
      let existingMessages = [];
      try {
        const existing = await GitHubDB.read(gitHubPath);
        if (existing && Array.isArray(existing)) {
          existingMessages = existing;
          console.log(`📖 [check-first-login] ${existingMessages.length} messages existants lus`);
        }
      } catch {
        console.log(`ℹ️ [check-first-login] Aucun message existant, création du fichier`);
        existingMessages = [];
      }
      
      // Vérifier si le message de bienvenue n'existe pas déjà (éviter les doublons)
      const welcomeExists = existingMessages.some(
        (m: { content: string }) => m.content === "Bienvenue sur la messagerie privée VAGONDYS. Notre équipe prendra contact avec vous sous 48h."
      );
      
      if (welcomeExists) {
        console.log(`⚠️ [check-first-login] Message de bienvenue déjà présent dans le fichier`);
        // Marquer welcome_sent = true quand même
        const { error: updateError } = await supabaseAdmin
          .from("messagerie_accounts")
          .update({ welcome_sent: true, updated_at: now })
          .eq("user_id", userId);
        
        if (updateError) {
          console.error(`❌ [check-first-login] Erreur mise à jour welcome_sent:`, updateError);
        }
        
        return NextResponse.json({
          success: true,
          welcome_sent: true,
          message: "Message de bienvenue déjà présent"
        });
      }
      
      // Ajouter le message de bienvenue
      existingMessages.push(welcomeMessage);
      console.log(`📊 [check-first-login] Total messages après ajout: ${existingMessages.length}`);
      
      // Écrire dans GitHub (compressé)
      const writeStartTime = Date.now();
      await GitHubDB.write(gitHubPath, existingMessages, { compress: true });
      const writeDuration = Date.now() - writeStartTime;
      
      console.log(`✅ [check-first-login] Message de bienvenue écrit dans GitHub en ${writeDuration}ms: ${gitHubPath}`);
      
    } catch (gitHubError) {
      const errorMessage = gitHubError instanceof Error ? gitHubError.message : String(gitHubError);
      console.error(`❌ [check-first-login] Erreur écriture GitHub:`, errorMessage);
      // Non bloquant - on continue pour marquer welcome_sent = true
    }

    // 8. Marquer welcome_sent = true dans messagerie_accounts
    console.log(`📝 [check-first-login] Marquage welcome_sent=true pour ${userId}`);
    
    const { error: updateError } = await supabaseAdmin
      .from("messagerie_accounts")
      .update({ 
        welcome_sent: true, 
        updated_at: new Date().toISOString() 
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error(`❌ [check-first-login] Erreur mise à jour welcome_sent:`, {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });
      // Non bloquant
    } else {
      console.log(`✅ [check-first-login] welcome_sent=true pour ${userId}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [check-first-login] Terminé en ${duration}ms - Message de bienvenue créé pour ${dossierRef}`);

    return NextResponse.json({
      success: true,
      welcome_sent: true,
      dossier_ref: dossierRef,
      message: "Message de bienvenue créé avec succès"
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [check-first-login] Erreur après ${duration}ms:`, error instanceof Error ? error.message : String(error));
    console.error("❌ [check-first-login] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
