
import { NextResponse } from 'next/server';
import { getStationConfig, createDynamicClient } from '@/lib/supabase/master';

interface HistoryMessage {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  document_url?: string | null;
  dossier_ref: string;
}

export async function POST(req: Request) {
  try {
    // ✅ IMPORTS DYNAMIQUES - Chargés UNIQUEMENT à l'exécution
    const { Resend } = await import('resend');
    const { createClient } = await import('@supabase/supabase-js');
    
    // ✅ Récupération des variables d'environnement à l'exécution
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_MASTER;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_MASTER;
    const gmailNoReply = process.env.GMAIL_NOREPLY || 'staff@vagondys.com';
    
    // ✅ Vérification des variables critiques
    if (!resendApiKey) {
      console.error("RESEND_API_KEY manquante");
    }
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase MASTER manquantes");
    }
    
    const resend = new Resend(resendApiKey || '');
    
    // CLIENT PUBLIC PAR DÉFAUT (MASTER) - créé à l'exécution
    const supabasePublicMaster = supabaseUrl && supabaseKey 
      ? createClient(supabaseUrl, supabaseKey) 
      : null;
    
    // CLIENT STAFF PAR DÉFAUT (MASTER)
    const supabaseStaffMaster = supabaseUrl && supabaseKey 
      ? createClient(supabaseUrl, supabaseKey) 
      : null;

    const body = await req.json();
    const {
      id,
      messageId,
      to,
      subject,
      message,
      agentEmail,
      docLink,
      dossierRef,
      cityCode,      // Paramètre d'aiguillage vers la station
      countryCode    // ✅ AJOUT 1 : Récupération du pays
    } = body;

    if (!messageId || !to) {
      return NextResponse.json({ error: "ID ou Destinataire manquant" }, { status: 400 });
    }

    // ✅ CORRECTION : Vérifier que dossierRef est fourni
    if (!dossierRef) {
      console.error("❌ send-reply: dossierRef manquant");
      return NextResponse.json({ error: "Référence dossier manquante" }, { status: 400 });
    }

    const cleanAgentEmail = agentEmail.toLowerCase();
    const cleanClientEmail = to.toLowerCase();
    const serviceNameRaw = (subject || "").split('_')[0].toUpperCase() || "ADMINISTRATION";
    const cleanDossierRef = String(dossierRef).trim().toUpperCase();
    const activeCity = cityCode && cityCode.toUpperCase() !== 'MASTER' ? cityCode.toUpperCase() : null;
    const activeCountry = countryCode || 'FR';
    
    console.log(`📧 send-reply: début pour dossier ${cleanDossierRef}, ville ${activeCity || 'MASTER'} (pays ${activeCountry})`);

    // --- LOGIQUE DYNAMIQUE PAR VILLE ---
    let targetStaffClient = supabaseStaffMaster;
    let targetPublicClient = supabasePublicMaster;
    let stationName = activeCity;

    // ✅ AJOUT 2 : AIGUILLAGE avec countryCode
    if (activeCity) {
      console.log(`📍 send-reply: aiguillage vers ${activeCity}/${activeCountry}`);
      const config = await getStationConfig(activeCity, activeCountry);
      if (config) {
        console.log(`✅ send-reply: config trouvée pour ${activeCity}/${activeCountry}`);
        // ✅ AJOUT 3 : Utilisation de countryCode dans createDynamicClient
        targetStaffClient = await createDynamicClient(activeCity, activeCountry, 'STAFF');
        targetPublicClient = await createDynamicClient(activeCity, activeCountry, 'PUBLIC');
      } else {
        console.warn(`⚠️ send-reply: configuration introuvable pour ${activeCity}/${activeCountry}`);
      }
    }

    // Vérification que les clients sont valides
    if (!targetStaffClient || !targetPublicClient) {
      console.error("Impossible d'initialiser les clients Supabase");
      return NextResponse.json({ error: "Configuration base de données invalide" }, { status: 500 });
    }

    // 1. RÉCUPÉRATION DU DOSSIER DANS LA BASE CIBLE (Ville ou Master)
    const { data: signalInfo, error: signalError } = await targetStaffClient
      .from('pending_signals')
      .select('*')
      .eq('dossier_ref', cleanDossierRef)
      .maybeSingle();

    if (signalError) {
      console.error("❌ send-reply: erreur récupération signal:", signalError);
    }

    if (!signalInfo) {
      console.warn(`⚠️ send-reply: aucun signal trouvé pour ${cleanDossierRef}`);
    } else {
      console.log(`✅ send-reply: signal trouvé pour ${cleanDossierRef}`);
      if (!stationName) stationName = signalInfo.payload?.city;
    }

    // 2. RÉCUPÉRATION DES ÉCHANGES DANS LA BASE CIBLE (pour l'historique dans l'email)
    const { data: historyData } = await targetStaffClient
      .from('communication_replies')
      .select('*')
      .eq('dossier_ref', cleanDossierRef)
      .order('created_at', { ascending: false });

    const history = historyData as HistoryMessage[] | null;

    let historyHtml = '';
    
    if (history && history.length > 0) {
      historyHtml += history.map((h: HistoryMessage) => `
        <div style="margin-top:15px; padding:15px; border-left:2px solid ${h.agent_email === 'CLIENT' ? '#52525b' : '#dc2626'}; background:#0c0c0e; border-radius:0 8px 8px 0;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:8px;">
            ${h.agent_email === 'CLIENT' ? 'VOTRE MESSAGE' : `RÉPONSE ${serviceNameRaw}`} — ${new Date(h.created_at).toLocaleString('fr-FR')}
          </p>
          <div style="font-size:12px; color:#a1a1aa; line-height:1.5;">${h.content.replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');
    }

    if (signalInfo && signalInfo.payload) {
      const firstMsg = signalInfo.payload.message;
      const firstDate = signalInfo.created_at;
      historyHtml += `
        <div style="margin-top:15px; padding:15px; border-left:2px solid #52525b; background:#0c0c0e; border-radius:0 8px 8px 0;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:8px;">
            VOTRE MESSAGE INITIAL — ${new Date(firstDate).toLocaleString('fr-FR')}
          </p>
          <div style="font-size:12px; color:#a1a1aa; line-height:1.5;">${firstMsg.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    }

    const now = new Date();
    const uniqueSalt = now.getTime().toString(36);

    // 3. ENVOI DE L'EMAIL VIA RESEND (uniquement si RESEND_API_KEY est présente)
    let mailError = null;
    if (resendApiKey) {
      const { error } = await resend.emails.send({
        from: `Vagondys Staff <${gmailNoReply}>`,
        to: [cleanClientEmail],
        bcc: ['vagondys@gmail.com'],
        replyTo: cleanAgentEmail,
        subject: `[${cleanDossierRef}] PROTOCOLE RÉPONSE : ${serviceNameRaw}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="margin:0; padding:0; background-color:black;">
            <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
              Transmission sécurisée concernant votre dossier ${cleanDossierRef}.
              ${"&nbsp;&zwnj;".repeat(100)} </div>

            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:black; color:white; font-family:sans-serif;">
              <tr>
                <td align="center" style="padding:40px;">
                  <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic; margin-bottom:10px;">
                    Protocole <span style="color:#dc2626;">Sécurisé</span>
                  </h1>
                  <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
                    Référence Dossier : ${cleanDossierRef}
                  </p>
                  <div style="max-width:600px; margin:0 auto; margin-bottom:30px; padding:25px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
                    <p style="font-size:16px; text-transform:uppercase; color:#dc2626; font-weight:bold; margin-bottom:20px;">Dernière Transmission : ${serviceNameRaw}</p>
                    <div style="font-size:14px; color:white; line-height:1.6; white-space: pre-wrap; background:#111; padding:15px; border-radius:8px; border:1px solid #18181b;">
                      ${message.replace(/\n/g, '<br>')}
                    </div>
                    ${docLink ? `
                      <div style="margin-top:25px; padding-top:15px; border-top:1px solid #18181b;">
                        <p style="font-size:9px; color:#71717a; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Document(s) joints :</p>
                        <a href="${docLink}" style="color:#dc2626; text-decoration:none; font-size:12px; font-weight:bold;">ACCÉDER AU DOCUMENT</a>
                      </div>
                    ` : ''}
                    ${historyHtml ? `
                      <div style="margin-top:40px; border-top:1px dashed #27272a; padding-top:20px;">
                        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Suivi complet du dossier :</p>
                        ${historyHtml}
                      </div>
                    ` : ''}
                  </div>
                  <div style="max-width:600px; margin:0 auto; border-top:1px solid #18181b; padding-top:20px; margin-top:30px; text-align:left;">
                    <p style="font-size:11px; color:#52525b; line-height:1.6;">
                      Ceci est une réponse officielle de la cellule VAGONDYS.<br>
                      Référence : <strong>${cleanDossierRef}</strong>.
                    </p>
                  </div>
                  <div style="display:none !important; font-size:0px;">ID-${uniqueSalt}</div>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });
      mailError = error;
      if (mailError) {
        console.error("❌ send-reply: erreur envoi email:", mailError);
      } else {
        console.log(`✅ send-reply: email envoyé à ${cleanClientEmail}`);
      }
    } else {
      console.warn(`⚠️ send-reply: email non envoyé à ${cleanClientEmail}: RESEND_API_KEY manquante`);
    }

    if (mailError) return NextResponse.json({ error: "Échec envoi" }, { status: 400 });

    const replyData = {
      id: id || crypto.randomUUID(),
      agent_email: cleanAgentEmail,
      content: message,
      document_url: docLink || null,
      dossier_ref: cleanDossierRef
    };

    // 4. MISE À JOUR DES BASES DE DONNÉES CIBLES (Insertion de la réponse et marquage comme lu)
    console.log(`📝 send-reply: insertion dans communication_replies pour ${cleanDossierRef}`);
    
    const [publicReplyInsert, staffReplyInsert, staffUpdate] = await Promise.all([
      targetPublicClient.from('communication_replies').insert([replyData]),
      targetStaffClient.from('communication_replies').insert([replyData]),
      targetStaffClient.from('pending_signals').update({ is_read: true }).eq('dossier_ref', cleanDossierRef)
    ]);

    if (staffReplyInsert.error) {
      console.error("❌ send-reply: erreur insertion STAFF dans communication_replies:", staffReplyInsert.error);
    } else {
      console.log(`✅ send-reply: insertion STAFF OK`);
    }
    
    if (publicReplyInsert.error) {
      console.warn("⚠️ send-reply: erreur insertion PUBLIC dans communication_replies:", publicReplyInsert.error);
    }

    if (staffUpdate.error) {
      console.error("❌ send-reply: erreur mise à jour STAFF is_read:", staffUpdate.error);
    } else {
      console.log(`✅ send-reply: mise à jour is_read STAFF OK`);
    }

    // 5. SYNCHRONISATION DE L'ARCHIVE GITHUB VERS LE REPO DE LA VILLE
    if (signalInfo) {
        const origin = new URL(req.url).origin;
        console.log(`📦 send-reply: archivage GitHub pour ${cleanDossierRef}`);
        try {
            await fetch(`${origin}/api/archive-external`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: signalInfo,
                    history: [],
                    purgeActive: false,
                    city_code: stationName || activeCity
                })
            });
            console.log(`✅ send-reply: archivage GitHub déclenché`);
        } catch (arcErr) {
            console.error("❌ send-reply: erreur synchro archive:", arcErr);
        }
    }

    console.log(`✅ send-reply: succès complet pour ${cleanDossierRef}`);
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur interne";
    console.error("❌ send-reply: erreur critique:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
