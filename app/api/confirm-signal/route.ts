
import { NextRequest, NextResponse } from 'next/server';
import { sendGeneralEmail } from "@/lib/email/gmail";
import { masterAdmin } from "@/lib/supabase/master";
import { randomUUID } from 'crypto';

// Définition de l'interface pour garantir la sécurité des données
interface SignalPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  city: string;
  country: string;
  original_subject?: string;
  confirmed_at?: string;
  messages_history?: Array<{
    content: string;
    created_at: string;
  }>;
  meta?: {
    is_returning_client?: boolean;
    is_resurrected?: boolean;
    first_contact?: boolean;
    created_at?: string;
    last_update?: string;
  };
}

// Interface pour les logs forcés (sans 'any')
interface ErrorLogData {
  event: string;
  [key: string]: string | number | boolean | object | undefined;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  context: string;
  message: string;
  stack?: string;
  details?: ErrorLogData;
  url?: string;
}

/**
 * FONCTION DE LOG FORCÉ - Écrit dans la console ET dans Supabase
 * Version adaptée pour l'Option B (un seul projet Supabase)
 */
async function forceLog(context: string, data: ErrorLogData, level: 'info' | 'warn' | 'error' = 'info'): Promise<string> {
  const errorMessage = typeof data === 'string' ? data : data.event || 'Unknown event';
  
  const logEntry: ErrorLog = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    context,
    message: errorMessage,
    details: data,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  };

  const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logMethod(`📋 [${context}]`, JSON.stringify(logEntry, null, 2));

  try {
    const { createClient } = await import("@supabase/supabase-js");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabaseLogs = createClient(supabaseUrl, supabaseKey);
      await supabaseLogs.from('error_logs').insert([logEntry]);
    }
  } catch {
    // Silencieux
  }

  return logEntry.id;
}

/**
 * API DE CONFIRMATION : Valide le signal via le lien envoyé par email
 * Version adaptée pour l'Option B (un seul projet Supabase)
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  await forceLog(`confirm-signal-${requestId}`, {
    event: 'DEBUT',
    url: request.url,
    method: request.method
  }, 'info');

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const city = searchParams.get('city');
  const country = searchParams.get('country') || 'FR';

  if (!id) {
    await forceLog(`confirm-signal-${requestId}`, {
      event: 'ERREUR_ID_MANQUANT',
      searchParams: JSON.stringify(Object.fromEntries(searchParams))
    }, 'error');
    return NextResponse.redirect(new URL('/contact?status=error&message=ID%20manquant', request.url));
  }

  if (!city) {
    await forceLog(`confirm-signal-${requestId}`, {
      event: 'ERREUR_VILLE_MANQUANTE',
      searchParams: JSON.stringify(Object.fromEntries(searchParams))
    }, 'error');
    return NextResponse.redirect(new URL('/contact?status=error&message=Ville%20manquante%20dans%20le%20lien', request.url));
  }

  try {
    await forceLog(`confirm-signal-${requestId}`, {
      event: 'PARAMETRES_RECUS',
      id: id || '',
      city: city || '',
      country
    }, 'info');

    // Version Option B : Un seul projet Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseStaff = createClient(supabaseUrl, supabaseServiceKey);
    const supabasePublic = createClient(supabaseUrl, supabaseKey);
    
    await forceLog(`confirm-signal-${requestId}`, {
      event: 'CLIENTS_SUPABASE_CREES',
      success: 'true'
    }, 'info');

    let signal;
    try {
      const { data, error: fetchError } = await supabaseStaff
        .from('pending_signals')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'SIGNAL_INTROUVABLE_STAFF',
          id: id || '',
          fetchError: fetchError?.message || 'Aucune donnée'
        }, 'error');
        return NextResponse.redirect(new URL('/contact?status=error&message=Signal%20introuvable%20-%20Vérifiez%20votre%20lien', request.url));
      }
      
      signal = data;
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'SIGNAL_TROUVE_STAFF',
        id: signal.id,
        dossier_ref: signal.dossier_ref || '',
        confirmed: String(signal.confirmed),
        email: signal.payload?.email || ''
      }, 'info');
    } catch (fetchSignalError) {
      const error = fetchSignalError as Error;
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'ERREUR_FETCH_SIGNAL',
        error: error.message
      }, 'error');
      throw fetchSignalError;
    }

    if (signal.confirmed) {
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'SIGNAL_DEJA_CONFIRME',
        id: id || ''
      }, 'warn');
      return NextResponse.redirect(new URL('/contact?status=confirmed', request.url));
    }

    const p = signal.payload as unknown as SignalPayload;
    const clientEmail = p.email.toLowerCase();
    const currentMessageForEmail = p.message;

    const signalCity = p.city?.toUpperCase() || city;
    const signalCountry = p.country?.toUpperCase() || country;
    
    if (signalCity !== city) {
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'INCOHERENCE_VILLE',
        urlCity: city,
        payloadCity: signalCity
      }, 'warn');
      
      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.set('city', signalCity);
      return NextResponse.redirect(redirectUrl);
    }
    
    if (signalCountry !== country) {
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'INCOHERENCE_PAYS',
        urlCountry: country,
        payloadCountry: signalCountry
      }, 'warn');
      
      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.set('country', signalCountry);
      return NextResponse.redirect(redirectUrl);
    }

    let finalDossierRef = signal.dossier_ref || '';

    let registryEntry;
    try {
      if (!masterAdmin) {
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'MASTER_ADMIN_NULL',
          message: 'masterAdmin est null, impossible d\'accéder à athletes_registry'
        }, 'error');
        throw new Error('masterAdmin non disponible');
      }
      
      const { data } = await masterAdmin
        .from('athletes_registry')
        .select('dossier_ref')
        .eq('email', clientEmail)
        .maybeSingle();
      
      registryEntry = data;
      
      if (registryEntry?.dossier_ref) {
        finalDossierRef = registryEntry.dossier_ref;
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'REF_TROUVEE_MASTER',
          dossier_ref: finalDossierRef
        }, 'info');
      }
    } catch (registryError) {
      const error = registryError as Error;
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'ERREUR_RECHERCHE_MASTER',
        error: error.message
      }, 'error');
    }

    if (!registryEntry?.dossier_ref) {
      try {
        const GITHUB_TOKEN = process.env.GITHUB_ARCHIVE_TOKEN;
        const GITHUB_REPO = process.env.GITHUB_ARCHIVE_REPO;
        const emailSlug = clientEmail.replace(/[@.]/g, '_');

        await forceLog(`confirm-signal-${requestId}`, {
          event: 'RECHERCHE_GITHUB_DEBUT',
          repo: GITHUB_REPO,
          emailSlug
        }, 'info');

        const githubRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/archives`,
          {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'VAGONDYS-APP'
            },
            next: { revalidate: 0 }
          }
        );

        if (githubRes.ok) {
          const files: Array<{name: string; path: string; download_url: string}> = await githubRes.json();
          const archivedFile = files.find((f) => f.name.toLowerCase().includes(emailSlug));
          
          if (archivedFile) {
            const refMatch = archivedFile.name.match(/VGD-[A-Z0-9]+/);
            if (refMatch) {
              finalDossierRef = refMatch[0];
              await forceLog(`confirm-signal-${requestId}`, {
                event: 'REF_TROUVEE_GITHUB_FICHIER',
                dossier_ref: finalDossierRef
              }, 'info');
            }
          } else {
            const recentFiles = files.slice(-15).reverse();
            for (const file of recentFiles) {
              const fileContentRes = await fetch(file.download_url);
              if (fileContentRes.ok) {
                const content = await fileContentRes.json();
                const fileEmail = content.dossier?.payload?.email || content.client_identity?.email;
                if (fileEmail && fileEmail.toLowerCase() === clientEmail) {
                  finalDossierRef = content.dossier?.dossier_ref || content.reference;
                  await forceLog(`confirm-signal-${requestId}`, {
                    event: 'REF_TROUVEE_GITHUB_CONTENU',
                    dossier_ref: finalDossierRef
                  }, 'info');
                  break;
                }
              }
            }
          }
        } else {
          await forceLog(`confirm-signal-${requestId}`, {
            event: 'ERREUR_GITHUB_API',
            status: String(githubRes.status),
            statusText: githubRes.statusText
          }, 'error');
        }
      } catch (ghError) {
        const error = ghError as Error;
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'ERREUR_GITHUB_EXCEPTION',
          error: error.message
        }, 'error');
      }
    }

    const rawSubject = (p.subject || "").toUpperCase();
    const serviceNameRaw = rawSubject.split('_')[0] || "CONTACT"; 
    const cleanServiceName = serviceNameRaw.toLowerCase(); 

    // Conserver et enrichir l'historique des messages
    const existingMessagesHistory = p.messages_history || [];
    
    const currentMessageExists = existingMessagesHistory.some(
      (msg) => msg.content === currentMessageForEmail
    );
    
    const updatedMessagesHistory = currentMessageExists
      ? existingMessagesHistory
      : [...existingMessagesHistory, {
          content: currentMessageForEmail,
          created_at: new Date().toISOString()
        }];

    const cleanPayload: SignalPayload = {
      ...p,
      email: clientEmail,
      subject: cleanServiceName,
      original_subject: rawSubject,
      confirmed_at: new Date().toISOString(),
      city: p.city,
      country: p.country,
      messages_history: updatedMessagesHistory,
      meta: {
        ...p.meta,
        is_returning_client: !!(registryEntry?.dossier_ref) || finalDossierRef !== signal.dossier_ref,
        is_resurrected: !registryEntry?.dossier_ref && finalDossierRef !== signal.dossier_ref
      }
    };

    // MISE À JOUR DANS STAFF
    try {
      const { error: staffUpdateError } = await supabaseStaff
        .from('pending_signals')
        .update({ 
          confirmed: true, 
          payload: cleanPayload,
          dossier_ref: finalDossierRef,
          is_read: false
        })
        .eq('id', id);

      if (staffUpdateError) {
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'ERREUR_UPDATE_STAFF',
          error: staffUpdateError.message
        }, 'error');
      } else {
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'UPDATE_STAFF_OK',
          id: id || ''
        }, 'info');
      }
    } catch (staffUpdateError) {
      const error = staffUpdateError as Error;
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'EXCEPTION_UPDATE_STAFF',
        error: error.message
      }, 'error');
    }

    // MISE À JOUR DANS PUBLIC
    try {
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'TENTATIVE_UPDATE_PUBLIC',
        city,
        id: id || '',
        dossier_ref: finalDossierRef
      }, 'info');

      const { data: existingPublicSignal } = await supabasePublic
        .from('pending_signals')
        .select('id')
        .eq('dossier_ref', finalDossierRef)
        .maybeSingle();

      let publicError;
      if (existingPublicSignal) {
        const { error: updatePublicError } = await supabasePublic
          .from('pending_signals')
          .update({
            payload: cleanPayload,
            confirmed: true,
            is_read: true,
            dossier_ref: finalDossierRef
          })
          .eq('dossier_ref', finalDossierRef);
        publicError = updatePublicError;
      } else {
        const { error: insertPublicError } = await supabasePublic
          .from('pending_signals')
          .insert([{
            id: id,
            dossier_ref: finalDossierRef,
            payload: cleanPayload,
            confirmed: true,
            is_read: true,
            is_new_athlete: signal.is_new_athlete,
            created_at: signal.created_at,
            city: city,
            country: country
          }]);
        publicError = insertPublicError;
      }

      if (publicError) {
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'ERREUR_PUBLIC',
          error: publicError.message
        }, 'error');
      } else {
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'PUBLIC_OK',
          id: id || ''
        }, 'info');
      }
    } catch (publicError) {
      const error = publicError as Error;
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'EXCEPTION_PUBLIC',
        error: error.message
      }, 'error');
    }

    // NOTIFICATIONS EMAIL
    let serviceEmail = "contact@vagondys.com";
    const s = serviceNameRaw; 
    if (s === "NANTES") serviceEmail = process.env.EMAIL_NANTES || "nantes@vagondys.com";
    else if (s === "COMMUNICATION") serviceEmail = process.env.EMAIL_COMMUNICATION || "communication@vagondys.com";
    else if (s === "SPONSORS") serviceEmail = process.env.EMAIL_SPONSORS || "sponsors@vagondys.com";
    else if (s === "LIGUE") serviceEmail = process.env.EMAIL_LIGUE || "ligue@vagondys.com";
    else if (s === "COMPETITION") serviceEmail = process.env.EMAIL_COMPETITION || "competition@vagondys.com";
    else if (s === "TOURNOIS") serviceEmail = process.env.EMAIL_TOURNOIS || "tournois@vagondys.com";
    else if (s === "PLAYER") serviceEmail = process.env.EMAIL_PLAYER || "player@vagondys.com";
    else if (s === "LICENCE" || s === "INSCRIPTION") serviceEmail = process.env.EMAIL_LICENCE || "licence@vagondys.com";
    else if (s === "RESERVATIONS") serviceEmail = process.env.EMAIL_RESERVATIONS || "reservations@vagondys.com";

    const admins = ["vagondys@gmail.com"];
    const staffDestinataires = [serviceEmail, ...admins];

    // Email au staff
    try {
      const { Resend } = await import("resend");
      const resendApiKey = process.env.RESEND_API_KEY;
      
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        
        await resend.emails.send({
          from: 'SIGNAL VAGONDYS <staff@vagondys.com>',
          to: staffDestinataires,
          subject: `🚨 [${finalDossierRef}] NOUVEAU SIGNAL : ${serviceNameRaw}`,
          html: `
            <div style="font-family:sans-serif; padding:20px; border:1px solid #eee; background:#fff; color:#000;">
              <h2 style="color:#cc0000; border-bottom:2px solid #cc0000; padding-bottom:10px;">ALERTE TRANSMISSION : ${serviceNameRaw}</h2>
              <p><strong>RÉFÉRENCE :</strong> ${finalDossierRef}</p>
              <hr>
              <p><strong>EXPÉDITEUR :</strong> ${p.name}</p>
              <p><strong>EMAIL :</strong> ${clientEmail}</p>
              <p><strong>MESSAGE :</strong></p>
              <div style="background:#f9f9f9; padding:15px; border-radius:5px; white-space: pre-wrap; border-left:4px solid #cc0000;">${currentMessageForEmail}</div>
            </div>
          `
        });
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'EMAIL_STAFF_OK'
        }, 'info');
      }
    } catch (emailErr) {
      console.error("Erreur email staff:", emailErr);
    }

    // Email au client
    const htmlContent = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Protocole <span style="color:#dc2626;">Sécurisé</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence Dossier : ${finalDossierRef}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Message transmis :</p>
          <p style="font-size:12px; font-style:italic; color:#a1a1aa;">"${currentMessageForEmail}"</p>
        </div>
        <p style="color:#22c55e; font-size:11px; text-transform:uppercase; font-weight:bold; letter-spacing:1px;">
          ✓ Transmission confirmée
        </p>
      </div>
    `;

    try {
      await sendGeneralEmail(
        clientEmail,
        `CONFIRMATION DE TRANSMISSION [${finalDossierRef}]`,
        `Transmission confirmée - Dossier ${finalDossierRef}`,
        htmlContent,
        "contact@vagondys.com"
      );
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'EMAIL_CLIENT_OK',
        to: clientEmail
      }, 'info');
    } catch (emailErr) {
      console.error("Erreur email client:", emailErr);
    }

    // ✅ ARCHIVAGE GITHUB OBLIGATOIRE - VERSION FIABLE
    let archiveSuccess = false;
    let archiveError: string | null = null;
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vagondys.com";
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'TENTATIVE_ARCHIVAGE_GITHUB',
        city,
        country
      }, 'info');
      
      // Utiliser la VRAIE ville du payload pour l'archivage
      const archiveCity = p.city || city;
      const archiveCountry = p.country || country;
      
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'ARCHIVAGE_VILLE_UTILISEE',
        ville: archiveCity,
        pays: archiveCountry
      }, 'info');
      
      // Construction du fullThread
      const uniqueMessages = new Map<string, { role: string; sender: string; content: string; created_at: string; is_initial: boolean }>();
      
      updatedMessagesHistory.forEach((msg, idx) => {
        const key = `${msg.content}_${msg.created_at}`;
        if (!uniqueMessages.has(key)) {
          uniqueMessages.set(key, {
            role: "public",
            sender: clientEmail,
            content: msg.content,
            created_at: msg.created_at,
            is_initial: idx === 0
          });
        }
      });
      
      const fullThread = [
        {
          role: "CLIENT_CONTACT_INFO",
          sender: "SYSTEM",
          content: `Fiche Contact : ${p.name} | Tel: ${p.phone || "Non renseigné"} | Email: ${clientEmail}`,
          created_at: signal.created_at,
          details: {
            name: p.name,
            phone: p.phone,
            email: clientEmail,
            subject: rawSubject
          }
        },
        ...Array.from(uniqueMessages.values())
      ];
      
      // Format correct pour processArchivePost
      const archivePayload = {
        message: {
          dossier_ref: finalDossierRef,
          created_at: signal.created_at,
          payload: {
            name: p.name,
            email: clientEmail,
            phone: p.phone || null,
            city: archiveCity,
            country: archiveCountry,
            subject: rawSubject,
            message: currentMessageForEmail,
            messages_history: updatedMessagesHistory
          }
        },
        history: [],
        purgeActive: false,
        city_code: archiveCity,
        country_code: archiveCountry,
        fullThread: fullThread
      };
      
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'PAYLOAD_ARCHIVAGE',
        dossier_ref: finalDossierRef,
        archiveCity,
        archiveCountry,
        messages_count: updatedMessagesHistory.length
      }, 'info');
      
      // Appel à l'API d'archivage
      const archiveRes = await fetch(`${baseUrl}/api/archive-external`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archivePayload)
      });

      if (!archiveRes.ok) {
        const errorText = await archiveRes.text();
        archiveError = `Status ${archiveRes.status}: ${errorText.substring(0, 500)}`;
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'ERREUR_ARCHIVAGE_GITHUB',
          status: String(archiveRes.status),
          response: errorText.substring(0, 500)
        }, 'error');
      } else {
        const archiveResult = await archiveRes.json();
        archiveSuccess = true;
        await forceLog(`confirm-signal-${requestId}`, {
          event: 'ARCHIVAGE_GITHUB_OK',
          result: JSON.stringify(archiveResult)
        }, 'info');
      }
    } catch (archiveErr) {
      archiveError = archiveErr instanceof Error ? archiveErr.message : String(archiveErr);
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'EXCEPTION_ARCHIVAGE_GITHUB',
        error: archiveError
      }, 'error');
    }
    
    if (!archiveSuccess) {
      await forceLog(`confirm-signal-${requestId}`, {
        event: 'ARCHIVAGE_ECHEC_MAIS_CONTINUE',
        error: archiveError || 'Erreur inconnue'
      }, 'warn');
    } else {
      console.log(`✅ confirm-signal: Archive GitHub créée avec succès pour ${finalDossierRef}`);
    }

    await forceLog(`confirm-signal-${requestId}`, {
      event: 'FIN_SUCCES',
      duration: String(Date.now() - startTime),
      archiveSuccess
    }, 'info');

    return NextResponse.redirect(new URL('/contact?status=confirmed', request.url));

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur de transmission";
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    await forceLog(`confirm-signal-${requestId}`, {
      event: 'ERREUR_CATASTROPHIQUE',
      error: errorObj.message,
      message: errorMessage,
      duration: String(Date.now() - startTime)
    }, 'error');
    
    console.error("❌ ERREUR CRITIQUE API CONFIRMATION:", errorMessage);
    return NextResponse.redirect(new URL(`/contact?status=error&message=${encodeURIComponent(errorMessage)}&id=${requestId}`, request.url));
  }
}
