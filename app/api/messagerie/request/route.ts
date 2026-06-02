
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { createClient } from "@supabase/supabase-js";

/**
 * Types pour les résultats de scan
 */
interface ScanResult {
  safe: boolean;
  virusDetected?: boolean;
  isAuthentic?: boolean;
  confidence?: number;
  error?: string;
}

/**
 * API d’envoi de demande d’inscription à la messagerie privée
 * POST /api/messagerie/request
 * Body: { full_name, email, company, phone, reason, turnstileToken, kbisUrl, kbisKey }
 * 
 * DELETE /api/messagerie/request?id=xxx
 * 
 * Accessible au public (avec validation Turnstile)
 * 
 * ✅ AJOUT : Validation KBis (obligatoire) + scan antivirus + IA
 * ✅ AJOUT : Méthode DELETE pour supprimer une demande
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Récupération des paramètres
    const body = await request.json();
    const { 
      full_name, 
      email, 
      company, 
      phone, 
      reason, 
      turnstileToken,
      kbisUrl,
      kbisKey 
    } = body;

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

    // ✅ Validation du KBis (obligatoire)
    if (!kbisUrl || !kbisKey) {
      return NextResponse.json(
        { error: "L'extrait KBis est obligatoire pour valider votre demande." },
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

    // 5. Vérifier si une demande existe déjà
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

    // ✅ Étape 6 : Scanner le document KBis (antivirus + IA)
    let scanResult: ScanResult = { safe: false };
    
    try {
      // Appel à l'API de scan de document
      const scanResponse = await fetch(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/api/scan-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: kbisUrl,
          fileKey: kbisKey,
        }),
      });

      if (scanResponse.ok) {
        scanResult = await scanResponse.json();
      } else {
        console.error("Erreur scan document:", await scanResponse.text());
        scanResult = { safe: false, error: "Service de scan temporairement indisponible" };
      }
    } catch (scanError) {
      console.error("Exception lors du scan:", scanError);
      scanResult = { safe: false, error: "Erreur technique lors du scan" };
    }

    // ✅ Si le document n'est pas sûr, rejeter la demande
    if (!scanResult.safe) {
      const errorMessage = scanResult.virusDetected 
        ? "Le fichier joint contient un virus. Demande rejetée."
        : scanResult.error || "Le document fourni n'a pas pu être validé.";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Générer un ID unique pour la demande
    const requestId = randomUUID();
    const displayId = requestId.substring(0, 8).toUpperCase();

    // 7. Insertion de la demande (avec les infos KBis)
    const newRequest = {
      id: requestId,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      company: company?.trim() || null,
      phone: phone?.trim() || null,
      reason: reason.trim(),
      status: "pending",
      kbis_url: kbisUrl,
      kbis_key: kbisKey,
      kbis_validated: scanResult.isAuthentic || false,
      kbis_scan_result: scanResult,
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

    // 8. Envoi d’un email de confirmation au demandeur
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    const adminEmail = process.env.ADMIN_EMAIL || "admin@vagondys.com";

    const confirmationHtml = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Demande <span style="color:#22c55e;">enregistrée</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence : ${displayId}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Votre demande a bien été reçue.</p>
          <p style="font-size:12px; color:#a1a1aa;">
            Notre équipe examinera votre demande dans les plus brefs délais.
            Vous recevrez un email de confirmation une fois votre compte activé.
          </p>
          <p style="font-size:10px; color:#22c55e; margin-top:10px;">
            ✓ Document KBis validé
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
      `Bonjour ${full_name},\n\nVotre demande a bien été enregistrée. Notre équipe l'examinera sous 48h.\n\nRéférence : ${displayId}`,
      confirmationHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    // 9. Envoi d’un email à l’admin pour notification
    const adminHtml = `
      <div style="background:black; color:white; padding:20px; font-family:sans-serif;">
        <h2 style="color:#dc2626;">📩 Nouvelle demande messagerie privée</h2>
        <p><strong>Demandeur :</strong> ${full_name}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Société :</strong> ${company || "Non renseignée"}</p>
        <p><strong>Téléphone :</strong> ${phone || "Non renseigné"}</p>
        <p><strong>Motif :</strong> ${reason}</p>
        <hr />
        <p><strong>Référence :</strong> ${displayId}</p>
        <p><strong>KBis :</strong> <a href="${kbisUrl}" target="_blank">Voir le document</a></p>
        <p><strong>Validation IA :</strong> ${scanResult.isAuthentic ? "✅ Authentique" : "⚠️ À vérifier"}</p>
        <p><strong>Confiance :</strong> ${Math.round((scanResult.confidence || 0) * 100)}%</p>
        <a href="${frontendUrl}/staff/admin/messagerie" style="background:#dc2626; color:white; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">
          Voir la demande
        </a>
      </div>
    `;

    await sendGeneralEmail(
      adminEmail,
      "🚨 VAGONDYS - Nouvelle demande messagerie privée",
      `Nouvelle demande de ${full_name} (${email}) - Réf: ${displayId}`,
      adminHtml,
      "no-reply@vagondys.com"
    ).catch(console.error);

    // 10. Réponse succès
    return NextResponse.json({
      success: true,
      message: "Demande envoyée avec succès",
      requestId: requestId,
    });
  } catch (error) {
    console.error("Erreur API messagerie/request POST:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

/**
 * ✅ AJOUT : Méthode DELETE pour supprimer une demande
 * DELETE /api/messagerie/request?id=xxx
 * 
 * Sécurité : Seul le staff/admin peut supprimer une demande
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Récupération de l'ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID de la demande manquant" },
        { status: 400 }
      );
    }

    // 2. Connexion à Supabase
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

    // 3. Récupérer l’utilisateur authentifié (vérifier que c'est le staff)
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

    // Vérifier que l’utilisateur est staff
    const userEmail = user.email?.toLowerCase() || "";
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

    // 4. Vérifier que la demande existe
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }

    // 5. Supprimer la demande
    const { error: deleteError } = await supabaseAdmin
      .from("pending_messagerie_requests")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Erreur suppression demande:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    // 6. (Optionnel) Supprimer le fichier KBis de R2 si nécessaire
    if (existingRequest.kbis_key) {
      try {
        const { R2Client } = await import("@/lib/storage/r2-client");
        await R2Client.deletePlayerDocument(existingRequest.kbis_key);
        console.log(`🗑️ Fichier KBis supprimé: ${existingRequest.kbis_key}`);
      } catch (r2Error) {
        console.error("Erreur suppression fichier R2:", r2Error);
        // Non bloquant
      }
    }

    return NextResponse.json({
      success: true,
      message: "Demande supprimée avec succès",
    });
  } catch (error) {
    console.error("Erreur API messagerie/request DELETE:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
