
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendVerificationEmail } from "@/lib/email/gmail";
import { registerAthlete, createDynamicClient } from "@/lib/supabase/master";

// ✅ PLUS DE CRÉATION DE CLIENT STATIQUE - Tout sera dynamique dans la fonction

export async function POST(request: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    
    // ✅ Récupération des variables (existent à l'exécution)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    
    // ✅ Vérification des variables (sans valeurs en dur)
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // ✅ Client Admin pour la base MASTER (créé à l'exécution seulement)
    const supabaseMasterAdmin = createClient(supabaseUrl, supabaseKey);

    const body = await request.json();
    const { 
      email, 
      password, 
      full_name, 
      pseudo, 
      phone, 
      city, 
      country, // "FRANCE" ou "ESPAGNE"
      dossierRef, 
      turnstileToken 
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
    
    // Normalisation du code pays pour le routage (ex: FRANCE -> FR, ESPAGNE -> ES)
    // On s'assure que c'est compatible avec les clés .env (ES_MADRID)
    const countryCode = (country === "ESPAGNE" || country === "ES") ? "ES" : "FR";

    // 2. Création de l'utilisateur via ADMIN
    const { data: authData, error: authError } = await supabaseMasterAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: false, 
      user_metadata: { 
        full_name, 
        pseudo, 
        city: cityCode,
        country: countryCode,
        dossier_ref: dossierRef 
      }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ error: "CET EMAIL EST DÉJÀ ENRÔLÉ DANS LE RÉSEAU." }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message.toUpperCase() }, { status: 400 });
    }

    // 3. Procédure d'inscription multi-bases
    if (authData?.user) {
      const userId = authData.user.id;

      try {
        // --- ÉTAPE A : ANNUAIRE GLOBAL (MASTER) ---
        await registerAthlete(userId, cleanEmail, cityCode, countryCode);

        // --- ÉTAPE B : CONNEXION DYNAMIQUE (VILLES) ---
        const cityPublicClient = await createDynamicClient(cityCode, countryCode, 'PUBLIC');
        
        let cityStaffClient;
        try {
          cityStaffClient = await createDynamicClient(cityCode, countryCode, 'STAFF');
        } catch {
          console.warn(`Mode STAFF non configuré pour ${countryCode}_${cityCode}, repli sur mode PUBLIC.`);
          cityStaffClient = cityPublicClient;
        }

        // Insertion Profil Athlète dans la base de la VILLE
        const { error: dbError } = await cityPublicClient
          .from("athletes")
          .insert([{
            id: userId,
            full_name: full_name,
            pseudo: pseudo || null,
            email: cleanEmail,
            phone: phone || null,
            city: cityCode,
            country: countryCode, 
            dossier_ref: dossierRef || "0",
            status: "INACTIF",
          }]);

        if (dbError) {
          // Si l'erreur est liée au cache du schéma, on tente une seconde fois après un mini-délai
          if (dbError.message.includes("cache")) {
             await new Promise(resolve => setTimeout(resolve, 500));
             const { error: retryError } = await cityPublicClient.from("athletes").insert([{
                id: userId, full_name, pseudo, email: cleanEmail, phone, city: cityCode, country: countryCode, dossier_ref: dossierRef, status: "INACTIF"
             }]);
             if (retryError) throw new Error(`BASE_VILLE_ERROR: ${retryError.message}`);
          } else {
            throw new Error(`BASE_VILLE_ERROR: ${dbError.message}`);
          }
        }

        // --- ÉTAPE C : SIGNALEMENT AU STAFF (BASE VILLE) ---
        const { error: staffError } = await cityStaffClient
          .from("pending_signals")
          .insert([{
            dossier_ref: dossierRef || "EN COURS...",
            payload: {
              name: full_name,
              pseudo: pseudo,
              email: cleanEmail,
              phone: phone,
              city: cityCode,
              country: country, // Nom complet pour le staff
              subject: "NOUVEL ENRÔLEMENT",
              message: `DEMANDE d'ACTIVATION POUR : ${full_name} (${cityCode} - ${countryCode}).`
            },
            confirmed: false,
            is_read: false,
            is_new_athlete: true,
            created_at: new Date().toISOString()
          }]);
          
        if (staffError) console.error("Erreur signalement staff (non bloquant):", staffError.message);

        // 4. GÉNÉRATION DU TOKEN DE CONFIRMATION (BASE MASTER)
        const confirmationToken = randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { error: tokenError } = await supabaseMasterAdmin
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

      } catch (subStepError: unknown) {
        // ROLLBACK : On supprime l'utilisateur Auth si une étape critique échoue
        const errorMessage = subStepError instanceof Error ? subStepError.message : "Erreur inconnue";
        await supabaseMasterAdmin.auth.admin.deleteUser(userId);
        
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
