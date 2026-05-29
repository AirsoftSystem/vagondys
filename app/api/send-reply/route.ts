
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { gzipSync } from 'zlib';

interface HistoryMessage {
  id: string;
  created_at: string;
  agent_email: string;
  content: string;
  document_url?: string | null;
  dossier_ref: string;
}

/**
 * Interface pour un message client (payload)
 */
interface ClientMessage {
  content: string;
  created_at: string;
}

/**
 * Interface pour un message générique (dédoublonnage)
 */
interface GenericMessage {
  content?: string;
  created_at?: string;
  agent_email?: string;
  sender?: string;
  id?: string;
  document_url?: string | null;
  dossier_ref?: string;
  role?: string;
  is_initial?: boolean;
}

/**
 * Élimine les doublons dans un tableau de messages
 */
function deduplicateMessages<T extends GenericMessage>(messages: T[]): T[] {
  const uniqueMap = new Map<string, T>();
  
  for (const msg of messages) {
    const contentKey = msg.content ? msg.content.substring(0, 200) : '';
    const dateKey = msg.created_at || '';
    const senderKey = msg.agent_email || msg.sender || '';
    const key = `${contentKey}_${dateKey}_${senderKey}`;
    
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, msg);
    }
  }
  
  return Array.from(uniqueMap.values());
}

export async function POST(req: Request) {
  try {
    // ✅ IMPORTS DYNAMIQUES - Chargés UNIQUEMENT à l'exécution
    const { Resend } = await import('resend');
    const { createClient } = await import('@supabase/supabase-js');
    
    // ✅ Récupération des variables d'environnement (Version Option B - un seul projet)
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const gmailNoReply = process.env.GMAIL_NOREPLY || 'staff@vagondys.com';
    
    // ✅ Vérification des variables critiques
    if (!resendApiKey) {
      console.error("RESEND_API_KEY manquante");
    }
    if (!supabaseUrl || !supabaseKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json({ error: "Configuration base de données invalide" }, { status: 500 });
    }
    
    const resend = new Resend(resendApiKey || '');
    
    // ✅ CLIENT UNIQUE (Option B)
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

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
      cityCode,
      countryCode
    } = body;

    if (!messageId || !to) {
      return NextResponse.json({ error: "ID ou Destinataire manquant" }, { status: 400 });
    }

    // ✅ Vérifier que dossierRef est fourni
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

    let stationName = activeCity;

    // 1. RÉCUPÉRATION DU DOSSIER
    const { data: signalInfo, error: signalError } = await supabaseClient
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

    // 2. RÉCUPÉRATION DES ÉCHANGES (pour l'historique dans l'email)
    const { data: historyData } = await supabaseClient
      .from('communication_replies')
      .select('*')
      .eq('dossier_ref', cleanDossierRef)
      .order('created_at', { ascending: false });

    const history = historyData as HistoryMessage[] | null;

    let historyHtml = '';
    
    // ✅ Utiliser un Set pour éviter les doublons dans l'email
    const emailMessagesSet = new Set<string>();
    
    if (history && history.length > 0) {
      const uniqueHistory = deduplicateMessages<HistoryMessage>(history);
      uniqueHistory.forEach((h: HistoryMessage) => {
        const msgKey = `${h.content}_${h.created_at}`;
        if (!emailMessagesSet.has(msgKey)) {
          emailMessagesSet.add(msgKey);
          historyHtml += `
            <div style="margin-top:15px; padding:15px; border-left:2px solid ${h.agent_email === 'CLIENT' ? '#52525b' : '#dc2626'}; background:#0c0c0e; border-radius:0 8px 8px 0;">
              <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:8px;">
                ${h.agent_email === 'CLIENT' ? 'VOTRE MESSAGE' : `RÉPONSE ${serviceNameRaw}`} — ${new Date(h.created_at).toLocaleString('fr-FR')}
              </p>
              <div style="font-size:12px; color:#a1a1aa; line-height:1.5;">${h.content.replace(/\n/g, '<br>')}</div>
            </div>
          `;
        }
      });
    }

    // ✅ Récupérer l'historique des messages du client depuis le payload (sans doublons)
    const clientMessagesHistory = (signalInfo?.payload?.messages_history || []) as ClientMessage[];
    const uniqueClientMessages = deduplicateMessages<ClientMessage>(clientMessagesHistory);
    
    // Ajouter l'historique des messages client dans l'email
    if (uniqueClientMessages.length > 0) {
      uniqueClientMessages.forEach((msg: ClientMessage, index: number) => {
        const msgKey = `${msg.content}_${msg.created_at}`;
        if (!emailMessagesSet.has(msgKey)) {
          emailMessagesSet.add(msgKey);
          historyHtml += `
            <div style="margin-top:15px; padding:15px; border-left:2px solid #52525b; background:#0c0c0e; border-radius:0 8px 8px 0;">
              <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:8px;">
                ${index === 0 ? 'MESSAGE INITIAL' : 'MESSAGE CLIENT'} — ${new Date(msg.created_at).toLocaleString('fr-FR')}
              </p>
              <div style="font-size:12px; color:#a1a1aa; line-height:1.5;">${msg.content.replace(/\n/g, '<br>')}</div>
            </div>
          `;
        }
      });
    }

    if (signalInfo && signalInfo.payload && uniqueClientMessages.length === 0) {
      const firstMsg = signalInfo.payload.message as string;
      const firstDate = signalInfo.created_at as string;
      const msgKey = `${firstMsg}_${firstDate}`;
      if (!emailMessagesSet.has(msgKey)) {
        emailMessagesSet.add(msgKey);
        historyHtml += `
          <div style="margin-top:15px; padding:15px; border-left:2px solid #52525b; background:#0c0c0e; border-radius:0 8px 8px 0;">
            <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:8px;">
              MESSAGE INITIAL — ${new Date(firstDate).toLocaleString('fr-FR')}
            </p>
            <div style="font-size:12px; color:#a1a1aa; line-height:1.5;">${firstMsg.replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }
    }

    const now = new Date();
    const uniqueSalt = now.getTime().toString(36);

    // 3. ENVOI DE L'EMAIL VIA RESEND
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

    const replyId = id || randomUUID();
    const replyData = {
      id: replyId,
      agent_email: cleanAgentEmail,
      content: message,
      document_url: docLink || null,
      dossier_ref: cleanDossierRef,
      city: stationName || activeCity || 'NANTES',
      country: activeCountry
    };

    // 4. MISE À JOUR DE LA BASE UNIQUE (Insertion de la réponse et marquage comme lu)
    console.log(`📝 send-reply: insertion dans communication_replies pour ${cleanDossierRef}`);
    
    const [replyInsert, staffUpdate] = await Promise.all([
      supabaseClient.from('communication_replies').insert([replyData]),
      supabaseClient.from('pending_signals').update({ is_read: true }).eq('dossier_ref', cleanDossierRef)
    ]);

    if (replyInsert.error) {
      console.error("❌ send-reply: erreur insertion communication_replies:", replyInsert.error);
    } else {
      console.log(`✅ send-reply: insertion OK`);
    }

    if (staffUpdate.error) {
      console.error("❌ send-reply: erreur mise à jour is_read:", staffUpdate.error);
    } else {
      console.log(`✅ send-reply: mise à jour is_read OK`);
    }

    // ✅ CORRECTION MAJEURE : NE PAS ajouter la réponse staff dans messages_history
    // Les réponses staff sont déjà dans communication_replies
    // messages_history ne doit contenir que les messages CLIENT
    // Ce bloc a été SUPPRIMÉ pour éviter les doublons

    // 5. SYNCHRONISATION DE L'ARCHIVE GITHUB AVEC COMPRESSION
    if (signalInfo) {
        const origin = new URL(req.url).origin;
        console.log(`📦 send-reply: archivage GitHub pour ${cleanDossierRef}`);
        
        // ✅ Récupérer le signal à archiver (sans modifier le payload)
        const { data: updatedSignal } = await supabaseClient
          .from('pending_signals')
          .select('*')
          .eq('dossier_ref', cleanDossierRef)
          .maybeSingle();
        
        const signalToArchive = updatedSignal || signalInfo;
        
        // ✅ Construire l'archive avec dédoublonnage
        const archivePayload = {
          message: signalToArchive,
          history: [],
          purgeActive: false,
          city_code: stationName || activeCity,
          country_code: activeCountry
        };
        
        // ✅ Compresser en GZIP avant envoi
        const jsonString = JSON.stringify(archivePayload);
        const compressed = gzipSync(jsonString);
        const compressedBase64 = compressed.toString('base64');
        
        console.log(`📦 send-reply: compression GZIP - original: ${jsonString.length} bytes, compressé: ${compressed.length} bytes (gain: ${((1 - compressed.length/jsonString.length) * 100).toFixed(1)}%)`);
        
        try {
            await fetch(`${origin}/api/archive-external`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Content-Encoding': 'gzip'
                },
                body: JSON.stringify({
                  ...archivePayload,
                  _compressed: compressedBase64,
                  _compressedFormat: 'gzip'
                })
            });
            console.log(`✅ send-reply: archivage GitHub déclenché (compressé)`);
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
