
"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { sendGeneralEmail } from "@/lib/email/gmail";
import { createClient } from "@supabase/supabase-js";

/**
 * INTERFACE POUR LES RÉSULTATS DE SCAN
 */
interface ScanResult {
  safe: boolean;
  virusDetected?: boolean;
  isAuthentic?: boolean;
  confidence?: number;
  error?: string;
}

/**
 * SERVER ACTION : Soumission d'une demande d'inscription à la messagerie privée
 * 
 * Copie le modèle de contact/actions.ts qui fonctionne parfaitement
 * - Récupère le token Turnstile directement via formData (pas de stockage React)
 * - Vérifie UNIQUEMENT l'existence du token (pas de vérification Cloudflare, comme Contact)
 * - Gère l'upload KBis, le scan antivirus, l'insertion en base et les emails
 */
export async function submitMessagerieRequest(formData: FormData) {
  
  // ==========================================================
  // 1. RÉCUPÉRATION DES CHAMPS DU FORMULAIRE
  // ==========================================================
  const full_name = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const company = formData.get("company") as string;
  const phone = formData.get("phone") as string;
  const reason = formData.get("reason") as string;
  const kbisUrl = formData.get("kbisUrl") as string;
  const kbisKey = formData.get("kbisKey") as string;
  
  // ==========================================================
  // 2. RÉCUPÉRATION DU TOKEN TURNSTILE (comme dans Contact)
  // ==========================================================
  const turnstileToken = formData.get("cf-turnstile-response");
  
  // ✅ UNIQUEMENT vérification de l'existence du token (pas de validation Cloudflare)
  // Comme dans contact/actions.ts, on ne fait PAS d'appel à Cloudflare
  if (!turnstileToken) {
    console.error("❌ Token Turnstile manquant");
    redirect("/messagerie/inscription?error=security_error");
  }
  
  // ==========================================================
  // 3. VALIDATION DES CHAMPS OBLIGATOIRES
  // ==========================================================
  if (!full_name || !full_name.trim()) {
    redirect("/messagerie/inscription?error=missing_name");
  }
  
  if (!email || !email.includes("@") || !email.includes(".")) {
    redirect("/messagerie/inscription?error=invalid_email");
  }
  
  if (!reason || !reason.trim()) {
    redirect("/messagerie/inscription?error=missing_reason");
  }
  
  // Validation du KBis (obligatoire)
  if (!kbisUrl || !kbisKey) {
    redirect("/messagerie/inscription?error=missing_kbis");
  }
  
  // ==========================================================
  // 4. CONNEXION À SUPABASE
  // ==========================================================
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Variables Supabase manquantes");
    redirect("/messagerie/inscription?error=config_error");
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  // ==========================================================
  // 5. VÉRIFIER SI UNE DEMANDE EXISTE DÉJÀ
  // ==========================================================
  const { data: existingRequests } = await supabaseAdmin
    .from("pending_messagerie_requests")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .in("status", ["pending", "approved"]);
  
  if (existingRequests && existingRequests.length > 0) {
    const hasPending = existingRequests.some(r => r.status === "pending");
    const hasApproved = existingRequests.some(r => r.status === "approved");
    
    if (hasPending) {
      redirect("/messagerie/inscription?error=already_pending");
    }
    if (hasApproved) {
      redirect("/messagerie/inscription?error=already_approved");
    }
  }
  
  // ==========================================================
  // 6. SCANNER LE DOCUMENT KBis (antivirus + IA)
  // ==========================================================
  let scanResult: ScanResult = { safe: false };
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
  
  try {
    const scanResponse = await fetch(`${frontendUrl}/api/scan-document`, {
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
      console.error("❌ Erreur scan document:", await scanResponse.text());
      scanResult = { safe: false, error: "Service de scan temporairement indisponible" };
    }
  } catch (scanError) {
    console.error("❌ Exception lors du scan:", scanError);
    scanResult = { safe: false, error: "Erreur technique lors du scan" };
  }
  
  // Si le document n'est pas sûr, rejeter la demande
  if (!scanResult.safe) {
    const errorMessage = scanResult.virusDetected 
      ? "virus_detected"
      : "invalid_document";
    redirect(`/messagerie/inscription?error=${errorMessage}`);
  }
  
  // ==========================================================
  // 7. CRÉATION DE LA DEMANDE
  // ==========================================================
  const requestId = randomUUID();
  const displayId = requestId.substring(0, 8).toUpperCase();
  const now = new Date().toISOString();
  
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
    created_at: now,
    updated_at: now,
  };
  
  const { error: insertError } = await supabaseAdmin
    .from("pending_messagerie_requests")
    .insert([newRequest]);
  
  if (insertError) {
    console.error("❌ Erreur insertion demande:", insertError);
    redirect("/messagerie/inscription?error=db_error");
  }
  
  // ==========================================================
  // 8. ENVOI DES EMAILS
  // ==========================================================
  const adminEmail = process.env.ADMIN_EMAIL || "admin@vagondys.com";
  
  // Email de confirmation au demandeur
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
    "VAGONDYS - Demande d'accès messagerie privée",
    `Bonjour ${full_name},\n\nVotre demande a bien été enregistrée. Notre équipe l'examinera sous 48h.\n\nRéférence : ${displayId}`,
    confirmationHtml,
    "no-reply@vagondys.com"
  ).catch(console.error);
  
  // Email de notification à l'admin
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
  
  // ==========================================================
  // 9. REDIRECTION VERS LA PAGE DE SUCCÈS
  // ==========================================================
  redirect("/messagerie/inscription?status=pending_validation");
}
