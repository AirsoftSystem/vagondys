
import { NextResponse } from 'next/server';

/**
 * API NOTIFY-READ : Version Option B (un seul projet Supabase)
 * Marque un signal comme lu et envoie l'avis de lecture.
 */
export async function POST(req: Request) {
  try {
    // ✅ IMPORT DYNAMIQUE - Chargé UNIQUEMENT à l'exécution, pas au build
    const { createClient } = await import("@supabase/supabase-js");
    const { Resend } = await import('resend');
    
    // ✅ Récupération des variables (Version Option B - un seul projet)
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const gmailNoReply = process.env.GMAIL_NOREPLY || 'no-reply@vagondys.com';
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.vagondys.com';
    
    // ✅ Vérification des variables
    if (!resendApiKey) {
      console.error("RESEND_API_KEY manquante");
    }
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
    }
    
    const resend = new Resend(resendApiKey || '');

    const body = await req.json();
    // ✅ Récupération des paramètres
    const { dossierRef, email, cityCode, countryCode } = body;

    if (!dossierRef) {
      return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
    }

    const cleanDossierRef = String(dossierRef).trim().toUpperCase();
    const activeCity = cityCode && cityCode.toUpperCase() !== 'MASTER' ? cityCode.toUpperCase() : null;
    const activeCountry = countryCode || 'FR';
    
    console.log(`🔍 notify-read: recherche dossier ${cleanDossierRef} pour ville ${activeCity || 'MASTER'} (pays ${activeCountry})`);

    // --- INITIALISATION DU CLIENT UNIQUE (Option B) ---
    if (!supabaseUrl || !supabaseKey) {
      console.error("Configuration Supabase manquante");
      return NextResponse.json({ error: "Configuration base de données invalide" }, { status: 500 });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 1. RÉCUPÉRATION DU SIGNAL
    let activeSignal = null;
    
    const { data: signalByRef, error: fetchError } = await supabaseClient
      .from('pending_signals')
      .select('*')
      .eq('dossier_ref', cleanDossierRef)
      .maybeSingle();

    if (fetchError) {
      console.error("Erreur récupération signal par ref:", fetchError.message);
    }

    if (signalByRef) {
      activeSignal = signalByRef;
      console.log(`✅ notify-read: signal trouvé par ref ${cleanDossierRef}`);
    }

    // Fallback par email si non trouvé par Ref
    if (!activeSignal && email) {
      console.log(`🔍 notify-read: recherche par email ${email}`);
      const { data: fallbackSignal } = await supabaseClient
        .from('pending_signals')
        .select('*')
        .eq('payload->>email', email.toLowerCase())
        .eq('is_read', false)
        .maybeSingle();
      
      if (fallbackSignal) {
        activeSignal = fallbackSignal;
        console.log(`✅ notify-read: signal trouvé par email, ref: ${fallbackSignal.dossier_ref}`);
      }
    }

    if (!activeSignal) {
      console.error(`❌ notify-read: aucun signal trouvé pour ref ${cleanDossierRef} ou email ${email}`);
      return NextResponse.json({ error: `Dossier introuvable` }, { status: 404 });
    }

    const finalDossierRef = activeSignal.dossier_ref;
    
    if (!finalDossierRef) {
      console.error(`❌ notify-read: signal trouvé mais sans dossier_ref`);
      return NextResponse.json({ error: "Signal trouvé mais référence manquante" }, { status: 400 });
    }

    if (activeSignal.is_read) {
      return NextResponse.json({ success: true, message: "Déjà marqué comme lu" });
    }

    // 2. MISE À JOUR (un seul client - Option B)
    console.log(`📝 notify-read: mise à jour is_read=true pour ${finalDossierRef}`);
    
    const { error: updateError } = await supabaseClient
      .from('pending_signals')
      .update({ is_read: true })
      .eq('dossier_ref', finalDossierRef);

    if (updateError) {
      console.error("❌ Erreur mise à jour:", updateError);
      throw updateError;
    }

    console.log(`✅ notify-read: mise à jour réussie pour ${finalDossierRef}`);

    // 3. ENVOI DE L'AVIS DE LECTURE (RESEND)
    const contactEmail = activeSignal.payload?.email;
    const contactName = activeSignal.payload?.name || "Client";
    const now = new Date();
    const timestamp = now.toLocaleTimeString('fr-FR');

    if (contactEmail && resendApiKey) {
      await resend.emails.send({
        from: `VAGONDYS <${gmailNoReply}>`,
        to: [contactEmail],
        subject: `[AVIS DE LECTURE] Dossier ${finalDossierRef} - ${timestamp}`,
        html: `
          <div style="font-family: sans-serif; background: #000; color: #fff; padding: 40px; border-radius: 10px;">
            <div style="border-left: 3px solid #dc2626; padding-left: 20px;">
              <h1 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #dc2626;">Avis de lecture officiel</h1>
              <p style="font-size: 18px; font-weight: bold;">Bonjour ${contactName},</p>
              <p style="color: #a1a1aa; line-height: 1.6;">
                Votre transmission référencée <strong>${finalDossierRef}</strong> vient d'être consultée par nos services (${activeCity || 'CENTRAL'}) à ${timestamp}.
              </p>
              <p style="color: #a1a1aa; line-height: 1.6;">
                Nos agents analysent actuellement les éléments fournis.
              </p>
              <div style="margin-top: 40px; padding: 25px; border: 1px solid #18181b; background: #09090b; border-radius: 12px; text-align: center;">
                <a href="${frontendUrl}/contact" 
                   style="display: inline-block; background: #dc2626; color: #fff; padding: 15px 35px; text-decoration: none; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; border-radius: 6px;">
                  Ouvrir le Formulaire de Contact
                </a>
              </div>
              <div style="margin-top: 30px; font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 1px;">
                Cellule VAGONDYS • Unité ${activeCity || 'MASTER'} (${activeCountry})
              </div>
            </div>
          </div>
        `
      });
      console.log(`📧 notify-read: avis de lecture envoyé à ${contactEmail}`);
    } else if (contactEmail && !resendApiKey) {
      console.warn(`Avis de lecture non envoyé à ${contactEmail}: RESEND_API_KEY manquante`);
    }

    return NextResponse.json({ success: true, city: activeCity || 'MASTER', country: activeCountry });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur lors de la mise à jour lecture";
    console.error("Erreur critique notify-read:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
