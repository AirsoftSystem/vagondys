
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { createClient } from "@supabase/supabase-js";
import { GitHubDB } from "@/lib/github-db/client"; // ✅ AJOUTÉ

/**
 * API d’approbation des demandes d’inscription à la messagerie privée
 * POST /api/messagerie/approve
 * Body: { requestId, action, notes? }
 * 
 * Action: 'approve' ou 'reject'
 * 
 * Sécurité : Seul le staff/admin peut appeler cette API
 * 
 * ✅ CORRECTION : Lecture UNIQUEMENT depuis Supabase (pas GitHub)
 * ✅ CORRECTION : Utilisation du dossier_ref existant (plus de génération)
 * ✅ CORRECTION : Upsert dans messagerie_accounts (vérification email OU dossier_ref)
 * ✅ CORRECTION : Status 'active' au lieu de 'pending' (contrainte CHECK)
 * ✅ AJOUT : Logs détaillés pour capturer l'erreur exacte de Supabase
 * ✅ AJOUT : Création du fichier GitHub avec message de bienvenue à l'approbation
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Connexion à Supabase (uniquement pour Auth et messagerie_accounts)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json(
        { error: "Configuration serveur invalide" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Récupérer l’utilisateur authentifié (via cookie de session)
    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // ✅ Vérifier que l'email de l'utilisateur est disponible
    const staffEmail = user.email;
    if (!staffEmail) {
      return NextResponse.json(
        { error: "Email utilisateur non disponible" },
        { status: 400 }
      );
    }

    // 3. Vérifier que l’utilisateur est staff
    const userEmail = staffEmail.toLowerCase();
    const isStaff = userEmail.endsWith("@vagondys.com");
    
    if (!isStaff) {
      const { data: staffRecord } = await supabaseAdmin
        .from("staff_registry")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();
      
      if (!staffRecord) {
        return NextResponse.json(
          { error: "Accès réservé au staff" },
          { status: 403 }
        );
      }
    }

    // 4. Récupération des paramètres
    const body = await request.json();
    const { requestId, action, notes } = body;

    if (!requestId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Paramètres invalides. requestId et action (approve/reject) requis" },
        { status: 400 }
      );
    }

    // ✅ 5. Récupérer la demande UNIQUEMENT depuis Supabase (pas GitHub)
    console.log(`📦 Récupération demande ${requestId} depuis pending_messagerie_requests`);
    
    const { data: supabaseRequest, error: supabaseError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    
    if (supabaseError || !supabaseRequest) {
      console.error("Demande introuvable:", supabaseError);
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }
    
    const requestData = supabaseRequest;
    const dossierRef = requestData.dossier_ref;
    
    if (!dossierRef) {
      console.error("La demande n'a pas de dossier_ref:", requestId);
      return NextResponse.json(
        { error: "Demande invalide: pas de référence dossier" },
        { status: 400 }
      );
    }

    if (requestData.status !== "pending") {
      return NextResponse.json(
        { error: `Cette demande a déjà été ${requestData.status === "approved" ? "approuvée" : "rejetée"}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const displayId = dossierRef.substring(0, 8).toUpperCase();

    if (action === "reject") {
      // Rejet de la demande
      const { error: updateError } = await supabaseAdmin
        .from("pending_messagerie_requests")
        .update({
          status: "rejected",
          reviewed_by: staffEmail,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("id", requestId);
      
      if (updateError) {
        console.error("Erreur mise à jour demande rejetée:", updateError);
        return NextResponse.json(
          { error: "Erreur lors du rejet de la demande" },
          { status: 500 }
        );
      }

      const rejectHtml = `
        <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
          <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
            Demande <span style="color:#dc2626;">non retenue</span>
          </h1>
          <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
            Référence : ${displayId}
          </p>
          <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
            <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Motif :</p>
            <p style="font-size:12px; color:#a1a1aa;">${notes || "Votre demande n’a pas été retenue par notre équipe."}</p>
          </div>
          <p style="margin-top:20px; font-size:10px; color:#52525b;">
            Vous pouvez soumettre une nouvelle demande ultérieurement.
          </p>
        </div>
      `;

      await sendGeneralEmail(
        requestData.email,
        "VAGONDYS - Demande d’accès messagerie privée",
        `Votre demande a été rejetée.`,
        rejectHtml,
        "no-reply@vagondys.com"
      ).catch(console.error);

      return NextResponse.json({ success: true, message: "Demande rejetée" });
    }

    // 6. APPROBATION DE LA DEMANDE
    const confirmationToken = randomUUID();

    // Génération d'un mot de passe temporaire
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generateSegment = (length: number) => {
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    const tempPassword = generateSegment(12);

    // 7. Création du compte Supabase Auth
    console.log(`📝 Création compte Auth pour ${requestData.email}`);
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: {
        full_name: requestData.full_name,
        company: requestData.company,
        role: "partner",
        account_type: "messagerie",
      },
    });

    if (createUserError) {
      console.error("❌ Erreur création utilisateur Auth (détail):", {
        message: createUserError.message,
        status: createUserError.status,
        name: createUserError.name,
      });
      return NextResponse.json(
        { error: `Erreur création compte: ${createUserError.message}` },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    console.log(`✅ Compte Auth créé pour ${requestData.email} (ID: ${userId})`);

    // 8. UPSERT dans messagerie_accounts - Vérification par email OU dossier_ref
    console.log(`📝 UPSERT dans messagerie_accounts pour ${dossierRef}`);
    
    // ✅ CORRECTION : Vérifier si un compte existe déjà pour cet email OU ce dossier_ref
    const { data: existingAccount, error: fetchAccountError } = await supabaseAdmin
      .from("messagerie_accounts")
      .select("id, email, dossier_ref")
      .or(`email.eq.${requestData.email},dossier_ref.eq.${dossierRef}`)
      .maybeSingle();

    if (fetchAccountError) {
      console.error("❌ Erreur vérification compte existant:", fetchAccountError);
    }

    // Log pour voir ce qui est trouvé
    console.log(`🔍 existingAccount trouvé:`, existingAccount ? `ID=${existingAccount.id}, email=${existingAccount.email}, dossier_ref=${existingAccount.dossier_ref}` : "AUCUN");

    let insertAccountError;
    if (existingAccount) {
      // Mise à jour du compte existant
      console.log(`ℹ️ Compte existant trouvé pour ${requestData.email} ou ${dossierRef}, mise à jour`);
      const { error: updateError } = await supabaseAdmin
        .from("messagerie_accounts")
        .update({
          user_id: userId,
          full_name: requestData.full_name,
          company: requestData.company,
          phone: requestData.phone,
          dossier_ref: dossierRef,
          role: "partner",
          status: "active",
          created_by: staffEmail,
          updated_at: now,
        })
        .eq("id", existingAccount.id);
      
      if (updateError) {
        console.error("❌ Erreur détaillée mise à jour messagerie_accounts:", {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        });
      }
      insertAccountError = updateError;
    } else {
      // Insertion d'un nouveau compte
      console.log(`ℹ️ Aucun compte existant, insertion d'un nouveau`);
      const { error: insertError } = await supabaseAdmin
        .from("messagerie_accounts")
        .insert({
          user_id: userId,
          email: requestData.email,
          full_name: requestData.full_name,
          company: requestData.company,
          phone: requestData.phone,
          dossier_ref: dossierRef,
          role: "partner",
          status: "active",
          created_by: staffEmail,
          created_at: now,
        });
      
      if (insertError) {
        console.error("❌ Erreur détaillée insertion messagerie_accounts:", {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        });
      }
      insertAccountError = insertError;
    }

    if (insertAccountError) {
      console.error("❌ Erreur upsert messagerie_accounts (final):", insertAccountError.message);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Erreur lors de l'enregistrement du compte: ${insertAccountError.message}` },
        { status: 500 }
      );
    }
    console.log(`✅ messagerie_accounts mis à jour pour ${dossierRef}`);

    // ✅ 8bis. CRÉATION DU FICHIER GITHUB AVEC MESSAGE DE BIENVENUE
    console.log(`📝 Création du fichier GitHub pour ${dossierRef} avec message de bienvenue`);
    
    try {
      const gitHubPath = `conversations/${dossierRef}/messages.json.gz`;
      
      // Créer le message de bienvenue
      const welcomeMessage = {
        id: randomUUID(),
        dossier_ref: dossierRef,
        sender_email: staffEmail,
        sender_name: "Staff VAGONDYS",
        content: "Bienvenue sur la messagerie privée VAGONDYS. Notre équipe prendra contact avec vous sous 48h.",
        file_url: null,
        file_key: null,
        is_read: false,
        created_at: now,
      };
      
      // Écrire dans GitHub (compressé)
      await GitHubDB.write(gitHubPath, [welcomeMessage], { compress: true });
      console.log(`✅ Fichier GitHub créé avec message de bienvenue: ${gitHubPath}`);
      
    } catch (gitHubError) {
      console.error("❌ Erreur création fichier GitHub:", gitHubError);
      // Non bloquant - on continue même si GitHub échoue
      // Le message sera créé lors du premier échange réel
    }

    // 9. Mettre à jour le statut de la demande
    const { error: updateRequestError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .update({
        status: "approved",
        reviewed_by: staffEmail,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", requestId);
    
    if (updateRequestError) {
      console.error("Erreur mise à jour demande approuvée:", updateRequestError);
    }

    // 10. Envoi de l’email de confirmation
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    const confirmUrl = `${frontendUrl}/api/messagerie/confirm?token=${confirmationToken}&email=${encodeURIComponent(requestData.email)}`;

    const welcomeHtml = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Accès <span style="color:#22c55e;">accordé</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence Dossier : ${dossierRef}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Votre demande a été acceptée.</p>
          <p style="font-size:12px; color:#a1a1aa;">
            Vous pouvez dès à présent activer votre compte en cliquant sur le lien ci-dessous.
          </p>
        </div>
        <a href="${confirmUrl}" style="background:#dc2626; color:white; padding:15px 30px; text-decoration:none; font-size:12px; font-weight:bold; border-radius:8px; display:inline-block; margin:20px 0;">
          ACTIVER MON COMPTE
        </a>
        <p style="font-size:10px; color:#52525b;">
          Ce lien expire dans 48 heures.
        </p>
        <hr style="margin:30px 0; border-color:#18181b;" />
        <p style="font-size:9px; color:#52525b;">
          Une fois activé, vous pourrez vous connecter avec votre adresse email et définir votre mot de passe.
        </p>
      </div>
    `;

    await sendGeneralEmail(
      requestData.email,
      "VAGONDYS - Votre accès à la messagerie privée",
      `Votre demande a été approuvée. Activez votre compte : ${confirmUrl}`,
      welcomeHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    // 11. Stocker le token de confirmation (Supabase)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const { error: tokenError } = await supabaseAdmin
      .from("email_confirmations")
      .insert({
        user_id: userId,
        email: requestData.email,
        token: confirmationToken,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (tokenError) {
      console.error("Erreur insertion token confirmation:", tokenError);
    }

    // 12. Archivage GitHub (pour mise à jour)
    try {
      const archivePayload = {
        message: {
          dossier_ref: dossierRef,
          created_at: now,
          payload: {
            name: requestData.full_name,
            email: requestData.email,
            company: requestData.company,
            phone: requestData.phone,
            reason: requestData.reason,
            type: "messagerie_request",
            status: "approved",
            reviewed_by: staffEmail,
            reviewed_at: now,
          },
        },
        history: [],
        purgeActive: false,
        city_code: "MASTER",
        country_code: "FR",
      };

      const archiveRes = await fetch(`${frontendUrl}/api/archive-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archivePayload),
      });

      if (!archiveRes.ok) {
        console.error("Erreur archivage GitHub:", await archiveRes.text());
      } else {
        console.log(`✅ Archivage GitHub réussi pour ${dossierRef}`);
      }
    } catch (archiveErr) {
      console.error("Erreur lors de l'archivage GitHub:", archiveErr);
    }

    return NextResponse.json({
      success: true,
      message: "Demande approuvée. Un email de confirmation a été envoyé.",
      dossier_ref: dossierRef,
    });
  } catch (error) {
    console.error("Erreur API messagerie/approve:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
