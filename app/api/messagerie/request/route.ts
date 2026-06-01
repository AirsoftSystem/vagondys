
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { createClient } from "@supabase/supabase-js";
import { generateVGDReference } from "@/lib/utils/references";

/**
 * API d’envoi de demande d’inscription à la messagerie privée
 * POST /api/messagerie/request
 * Body: { full_name, email, company, phone, reason, turnstileToken }
 * 
 * Accessible au public (avec validation Turnstile)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Récupération des paramètres
    const body = await request.json();
    const { full_name, email, company, phone, reason, turnstileToken } = body;

    // 2. Validation des champs obligatoires
    if (!full_name || !email || !reason) {
      return NextResponse.json(
        { error: "Nom complet, email et motif sont requis" },
        { status: 400 }
      );
    }

    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { error: "Adresse email invalide" },
        { status: 400 }
      );
    }

    // 3. Vérification Turnstile (anti-bot)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      console.error("Turnstile secret manquant");
      return NextResponse.json(
        { error: "Configuration de sécurité manquante" },
        { status: 500 }
      );
    }

    if (!turnstileToken) {
      return NextResponse.json(
        { error: "Validation anti-bot requise" },
        { status: 400 }
      );
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: turnstileToken,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return NextResponse.json(
        { error: "Échec de la validation anti-bot" },
        { status: 403 }
      );
    }

    // 4. Connexion à Supabase
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

    // 5. Vérifier si une demande existe déjà pour cet email (en attente ou approuvée)
    const { data: existingRequests, error: checkError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .in("status", ["pending", "approved"]);

    if (checkError) {
      console.error("Erreur vérification demande existante:", checkError);
    }

    if (existingRequests && existingRequests.length > 0) {
      const hasPending = existingRequests.some(r => r.status === "pending");
      const hasApproved = existingRequests.some(r => r.status === "approved");

      if (hasPending) {
        return NextResponse.json(
          { error: "Une demande est déjà en attente de validation pour cet email." },
          { status: 400 }
        );
      }

      if (hasApproved) {
        return NextResponse.json(
          { error: "Un compte existe déjà pour cet email. Veuillez vous connecter." },
          { status: 400 }
        );
      }
    }

    // ✅ CORRECTION : Générer une vraie référence VAGONDYS au lieu d'utiliser l'UUID tronqué
    const requestReference = generateVGDReference();

    // 6. Insertion de la demande
    const newRequest = {
      id: randomUUID(),
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      company: company?.trim() || null,
      phone: phone?.trim() || null,
      reason: reason.trim(),
      status: "pending",
      reference: requestReference, // ✅ AJOUT : Stocker la vraie référence
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .insert([newRequest]);

    if (insertError) {
      console.error("Erreur insertion demande:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la demande" },
        { status: 500 }
      );
    }

    // 7. Envoi d’un email de confirmation au demandeur
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    const adminEmail = process.env.ADMIN_EMAIL || "admin@vagondys.com";

    const confirmationHtml = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Demande <span style="color:#22c55e;">enregistrée</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence : ${requestReference}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Votre demande a bien été reçue.</p>
          <p style="font-size:12px; color:#a1a1aa;">
            Notre équipe examinera votre demande dans les plus brefs délais.
            Vous recevrez un email de confirmation une fois votre compte activé.
          </p>
        </div>
        <p style="font-size:10px; color:#52525b;">
          Délai de traitement estimé : 48h ouvrées.
        </p>
      </div>
    `;

    await sendGeneralEmail(
      email,
      "VAGONDYS - Demande d’accès messagerie privée",
      `Bonjour ${full_name},\n\nVotre demande a bien été enregistrée. Notre équipe l'examinera sous 48h.\n\nRéférence : ${requestReference}`,
      confirmationHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    // 8. Envoi d’un email à l’admin pour notification
    const adminHtml = `
      <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
        <h2 style="color:#dc2626;">📩 Nouvelle demande messagerie privée</h2>
        <p><strong>Demandeur :</strong> ${full_name}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Société :</strong> ${company || "Non renseignée"}</p>
        <p><strong>Téléphone :</strong> ${phone || "Non renseigné"}</p>
        <p><strong>Motif :</strong> ${reason}</p>
        <hr />
        <p><strong>Référence :</strong> ${requestReference}</p>
        <a href="${frontendUrl}/staff/admin/messagerie" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">
          Voir la demande
        </a>
      </div>
    `;

    await sendGeneralEmail(
      adminEmail,
      "🚨 VAGONDYS - Nouvelle demande messagerie privée",
      `Nouvelle demande de ${full_name} (${email}) - Réf: ${requestReference}`,
      adminHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    // 9. Réponse succès
    return NextResponse.json({
      success: true,
      message: "Demande envoyée avec succès",
      reference: requestReference,
    });
  } catch (error) {
    console.error("Erreur API messagerie/request:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
