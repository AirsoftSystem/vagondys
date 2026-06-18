
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendVerificationEmail } from "@/lib/email/gmail";
import { registerAthlete } from "@/lib/supabase/master";
import { SupabaseClient } from "@supabase/supabase-js";

// ✅ PLUS DE CRÉATION DE CLIENT DYNAMIQUE - Version Option B (un seul projet)

/**
 * Générateur de matricule 100% ALÉATOIRE
 * Format : VGD- + 8 caractères (Mélange aléatoire Lettres/Chiffres)
 */
function generateVGDReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VGD-${result}`;
}

/**
 * ✅ NOUVELLE FONCTION : Recherche un dossier_ref existant pour un email
 * Ordre de recherche :
 * 1. athletes_registry
 * 2. pending_signals
 * 3. Archive GitHub
 * ✅ CORRECTION : Remplacé 'any' par 'SupabaseClient'
 */
async function findExistingDossierRef(
  email: string,
  supabaseAdmin: SupabaseClient,
  siteUrl: string
): Promise<string | null> {
  const cleanEmail = email.toLowerCase().trim();
  
  console.log(`🔍 [signup] Recherche dossier_ref existant pour ${cleanEmail}`);

  // 1. Recherche dans athletes_registry
  try {
    const { data: registry } = await supabaseAdmin
      .from("athletes_registry")
      .select("dossier_ref")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (registry?.dossier_ref && registry.dossier_ref !== "0") {
      console.log(`✅ [signup] dossier_ref trouvé dans athletes_registry: ${registry.dossier_ref}`);
      return registry.dossier_ref;
    }
  } catch (err) {
    console.warn("⚠️ [signup] Erreur recherche athletes_registry:", err);
  }

  // 2. Recherche dans pending_signals
  try {
    const { data: pendingSignal } = await supabaseAdmin
      .from("pending_signals")
      .select("dossier_ref")
      .eq("payload->>email", cleanEmail)
      .not("dossier_ref", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingSignal?.dossier_ref && pendingSignal.dossier_ref !== "0") {
      console.log(`✅ [signup] dossier_ref trouvé dans pending_signals: ${pendingSignal.dossier_ref}`);
      return pendingSignal.dossier_ref;
    }
  } catch (err) {
    console.warn("⚠️ [signup] Erreur recherche pending_signals:", err);
  }

  // 3. Recherche dans Archive GitHub
  try {
    const emailSlug = cleanEmail.replace(/[@.]/g, "_");
    const searchUrl = `${siteUrl}/api/archive-external/find-by-email?search=${emailSlug}`;
    const searchRes = await fetch(searchUrl);
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.dossier_ref) {
        console.log(`✅ [signup] dossier_ref trouvé dans GitHub: ${searchData.dossier_ref}`);
        return searchData.dossier_ref;
      }
    }
  } catch (err) {
    console.warn("⚠️ [signup] Erreur recherche GitHub:", err);
  }

  console.log(`ℹ️ [signup] Aucun dossier_ref existant trouvé pour ${cleanEmail}`);
  return null;
}

export async function POST(request: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables (Version Option B - un seul projet)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    
    // ✅ Vérification des variables
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client Admin pour le projet UNIQUE (créé à l'exécution seulement)
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const body = await request.json();
    const { 
      email, 
      password, 
      full_name, 
      pseudo, 
      phone, 
      city, 
      country, // "FRANCE" ou "ESPAGNE"
      dossierRef: providedDossierRef, 
      turnstileToken,
      type // ✅ AJOUT : Type de demande (client, communication, divers, supplier, partner, advertising, sponsor)
    } = body;

    // 1. Validation Turnstile (Sécurité Anti-Bot)
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.TURNSTILE_SECRET_KEY}&response=${turnstileToken}`,
    });
    
    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return NextResponse.json({ error: "ÉCHEC DE LA VALIDATION ANTI-BOT (TURNSTILE)" }, { status: 403 });
    }

    // --- PRÉPARATION DES DONNÉES ---
    const cityCode = (city || "NANTES").toUpperCase().trim();
    const cleanEmail = email.toLowerCase().trim();
    
    // Normalisation du code pays
    const countryCode = (country === "ESPAGNE" || country === "ES") ? "ES" : "FR";

    // ✅ RECHERCHE DU DOSSIER_REF EXISTANT
    let existingDossierRef: string | null = null;
    
    // Si un dossierRef a été fourni dans le body, on le vérifie d'abord
    if (providedDossierRef && providedDossierRef !== "0") {
      existingDossierRef = providedDossierRef;
      console.log(`📦 [signup] dossierRef fourni dans le body: ${existingDossierRef}`);
    } else {
      // Recherche dans les sources existantes
      existingDossierRef = await findExistingDossierRef(cleanEmail, supabaseAdmin, frontendUrl);
    }
    
    // ✅ Déterminer le dossier_ref final (existant ou nouveau)
    const finalDossierRef = existingDossierRef || generateVGDReference();
    console.log(`📦 [signup] dossier_ref final: ${finalDossierRef} (${existingDossierRef ? 'RÉUTILISÉ' : 'NOUVEAU'})`);

    // 2. Création de l'utilisateur via ADMIN
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: false, 
      user_metadata: { 
        full_name, 
        pseudo, 
        city: cityCode,
        country: countryCode,
        dossier_ref: finalDossierRef 
      }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ error: "CET EMAIL EST DÉJÀ ENRÔLÉ DANS LE RÉSEAU." }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message.toUpperCase() }, { status: 400 });
    }

    // 3. Procédure d'inscription - Version Option B (un seul projet)
    if (authData?.user) {
      const userId = authData.user.id;

      try {
        // --- ÉTAPE A : ANNUAIRE GLOBAL (MASTER) ---
        await registerAthlete(userId, cleanEmail, cityCode, countryCode);

        // --- ÉTAPE B : INSERTION DIRECTE DANS LE PROJET UNIQUE (Option B) ---
        // Plus besoin de createDynamicClient - on utilise le même client admin
        
        // Insertion Profil Athlète dans la table athletes (avec city pour filtrage)
        const { error: dbError } = await supabaseAdmin
          .from("athletes")
          .insert([{
            id: userId,
            full_name: full_name,
            pseudo: pseudo || null,
            email: cleanEmail,
            phone: phone || null,
            city: cityCode,
            country: countryCode, 
            dossier_ref: finalDossierRef,
            status: "INACTIF",
            rank: "RECRUE",
            points: 0,
            total_matches: 0,
            total_score: 0,
            total_shots: 0,
            total_kills: 0,
            total_deaths: 0,
            total_assists: 0,
            total_hits_head: 0,
            total_hits_body: 0,
            total_hits_legs: 0,
            current_grade_id: 1,
            precision_progress: 0,
            current_cycle_shot_count: 0,
            current_cycle_precision: 0
          }]);

        if (dbError) {
          // Si l'erreur est liée au cache du schéma, on tente une seconde fois après un mini-délai
          if (dbError.message.includes("cache")) {
             await new Promise(resolve => setTimeout(resolve, 500));
             const { error: retryError } = await supabaseAdmin.from("athletes").insert([{
                id: userId, full_name, pseudo, email: cleanEmail, phone, city: cityCode, country: countryCode, dossier_ref: finalDossierRef, status: "INACTIF",
                rank: "RECRUE", points: 0, total_matches: 0, total_score: 0, total_shots: 0, total_kills: 0, total_deaths: 0, total_assists: 0,
                total_hits_head: 0, total_hits_body: 0, total_hits_legs: 0, current_grade_id: 1, precision_progress: 0,
                current_cycle_shot_count: 0, current_cycle_precision: 0
             }]);
             if (retryError) throw new Error(`BASE_VILLE_ERROR: ${retryError.message}`);
          } else {
            throw new Error(`BASE_VILLE_ERROR: ${dbError.message}`);
          }
        }

        // --- ÉTAPE C : SIGNALEMENT AU STAFF (table pending_signals dans le même projet) ---
        const { error: staffError } = await supabaseAdmin
          .from("pending_signals")
          .insert([{
            dossier_ref: finalDossierRef,
            payload: {
              name: full_name,
              pseudo: pseudo,
              email: cleanEmail,
              phone: phone,
              city: cityCode,
              country: country, // Nom complet pour le staff
              subject: "NOUVEL ENRÔLEMENT",
              message: `DEMANDE d'ACTIVATION POUR : ${full_name} (${cityCode} - ${countryCode}).`,
              // ✅ AJOUT : Type de demande pour le filtrage
              request_type: type || "partner"
            },
            confirmed: false,
            is_read: false,
            is_new_athlete: !existingDossierRef, // ✅ Nouveau joueur si pas de dossier existant
            created_at: new Date().toISOString(),
            city: cityCode,
            country: countryCode
          }]);
          
        if (staffError) console.error("Erreur signalement staff (non bloquant):", staffError.message);

        // 4. GÉNÉRATION DU TOKEN DE CONFIRMATION (BASE MASTER)
        const confirmationToken = randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { error: tokenError } = await supabaseAdmin
          .from("email_confirmations")
          .insert([{
            user_id: userId,
            email: cleanEmail,
            token: confirmationToken,
            expires_at: expiresAt.toISOString(),
            used: false
          }]);

        if (tokenError) throw new Error(`TOKEN_ERROR: ${tokenError.message}`);

        // 5. ENVOI DE L'EMAIL
        try {
          const targetBase = (process.env.NEXT_PUBLIC_FRONTEND_URL?.includes("localhost")) 
            ? "https://vagondys.com" 
            : (process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com");

          const confirmUrl = `${targetBase}/api/confirm-email?token=${confirmationToken}`;
          
          await sendVerificationEmail(
            cleanEmail,
            confirmUrl,
            full_name,
            cityCode, 
            "CELLULE D'ENRÔLEMENT"
          );
        } catch (emailErr) {
          console.error("Erreur envoi email (non bloquant):", emailErr);
        }

        // ✅ MISE À JOUR DU DOSSIER_REF DANS ATHLETES_REGISTRY SI NÉCESSAIRE
        if (existingDossierRef) {
          // Si un dossier_ref existait, on s'assure qu'il est bien lié
          try {
            await supabaseAdmin
              .from("athletes_registry")
              .update({ dossier_ref: finalDossierRef })
              .eq("email", cleanEmail);
          } catch (updateErr) {
            console.warn("⚠️ [signup] Erreur mise à jour registry:", updateErr);
          }
        }

      } catch (subStepError: unknown) {
        // ROLLBACK : On supprime l'utilisateur Auth si une étape critique échoue
        const errorMessage = subStepError instanceof Error ? subStepError.message : "Erreur inconnue";
        await supabaseAdmin.auth.admin.deleteUser(userId);
        
        console.error("ÉCHEC PROCÉDURE INSCRIPTION (ROLLBACK EFFECTUÉ):", errorMessage);
        return NextResponse.json(
          { error: `ERREUR CRITIQUE : ${errorMessage}` }, 
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "INSCRIPTION RÉUSSIE. VEUILLEZ CONFIRMER VOTRE EMAIL PAR LE LIEN ENVOYÉ." 
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("CRASH SERVEUR SIGNUP:", errorMessage);
    return NextResponse.json(
      { error: "UNE ERREUR SERVEUR EST SURVENUE LORS DE LA CRÉATION DU COMPTE" },
      { status: 500 }
    );
  }
}
