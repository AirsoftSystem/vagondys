
"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { sendGeneralEmail } from "@/lib/email/gmail";

// --- DÉFINITION DES TYPES ---
interface SignalPayload {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  city: string;
  country: string;
  messages_history?: Array<{
    content: string;
    created_at: string;
    file_url?: string;
    file_key?: string;
  }>;
  file_url?: string;
  file_key?: string;
}

// ✅ Définition des catégories qui vont directement à admin@vagondys.com
const CENTRALIZED_SUBJECTS = [
  'COMMUNICATION',
  'SPONSORS',
  'LIGUE',
  'INSCRIPTION',
  'LICENCE'
];

// ✅ Définition des catégories qui sont filtrées par ville
const CITY_FILTERED_SUBJECTS = [
  'PLAYER',
  'COMPETITION',
  'TOURNOIS',
  'RESERVATIONS'
];

/**
 * ACTION 1 : Envoi du formulaire initial
 * Version adaptée pour l'Option B avec redirection intelligente selon l'objet
 * ✅ AJOUT : Gestion des fichiers joints (file_url, file_key)
 */
export async function submitContact(formData: FormData) {
  
  // Version Option B : Un seul projet Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vagondys.com";
  
  if (!supabaseUrl || !supabaseKey) {
    redirect("/contact?status=error");
  }
  
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseMaster = createClient(supabaseUrl, supabaseKey);
  
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  let subject = String(formData.get("subject") || "").trim().toUpperCase();
  const message = String(formData.get("message") || "").trim();
  const originalCountry = String(formData.get("country") || "FR").trim().toUpperCase();
  const originalCity = String(formData.get("city") || "NANTES").trim().toUpperCase();
  
  // ✅ Récupération des champs fichier
  const fileUrl = String(formData.get("file_url") || "").trim();
  const fileKey = String(formData.get("file_key") || "").trim();

  const token = formData.get("cf-turnstile-response");
  if (!token) {
    redirect("/contact?status=security_error");
  }

  try {
    // ✅ REDIRECTION INTELLIGENTE SELON L'OBJET
    let targetCity = originalCity;
    let targetCountry = originalCountry;
    let isCentralized = CENTRALIZED_SUBJECTS.includes(subject);
    
    // Si l'objet est centralisé, on redirige vers admin@vagondys.com
    if (isCentralized) {
      targetCity = 'MASTER';
      targetCountry = 'FR';
      console.log(`📧 Message centralisé: ${subject} → admin@vagondys.com`);
    } else if (!CITY_FILTERED_SUBJECTS.includes(subject)) {
      // Si l'objet n'est ni centralisé ni filtré par ville, on le met en COMMUNICATION par défaut
      subject = 'COMMUNICATION';
      targetCity = 'MASTER';
      targetCountry = 'FR';
      isCentralized = true;
      console.log(`📧 Objet non reconnu, redirection vers COMMUNICATION (centralisé)`);
    } else {
      console.log(`📧 Message filtré par ville: ${subject} → ${targetCity}`);
    }

    // 1. RECHERCHE DANS LE REGISTRE MASTER
    const { data: registryEntry } = await supabaseMaster
      .from('athletes_registry')
      .select('city, country, dossier_ref')
      .eq('email', email)
      .maybeSingle();

    let existingDossierRef: string | null = registryEntry?.dossier_ref || null;
    
    // 2. RECHERCHE DANS PENDING_SIGNALS (avec filtre city si non centralisé)
    if (!existingDossierRef) {
      try {
        let query = supabaseMaster
          .from('pending_signals')
          .select('dossier_ref')
          .eq('payload->>email', email)
          .not('dossier_ref', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
        
        // Ajouter le filtre city si ce n'est pas un message centralisé
        if (!isCentralized) {
          query = query.eq('city', targetCity);
        }
        
        const { data: existingSignal } = await query.maybeSingle();
        
        if (existingSignal?.dossier_ref) {
          existingDossierRef = existingSignal.dossier_ref;
        }
      } catch {
        // Ignoré
      }
    }
    
    // 3. RECHERCHE DANS GITHUB
    if (!existingDossierRef) {
      try {
        const searchUrl = `${siteUrl}/api/archive-external?search=${email.toLowerCase().replace(/[@.]/g, '_')}&city_code=${targetCity}&country_code=${targetCountry}`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.dossier_ref) {
            existingDossierRef = searchData.dossier_ref;
          }
        }
      } catch {
        // Ignoré
      }
    }

    let dossier_ref: string;
    let isNewDossier = false;
    
    if (existingDossierRef) {
      dossier_ref = existingDossierRef;
    } else {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const generateSegment = (length: number) => {
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      dossier_ref = `VGD-${generateSegment(4)}${generateSegment(4)}`;
      isNewDossier = true;
    }

    let insertData;
    
    // 5. VÉRIFICATION SI SIGNAL EXISTE DÉJÀ
    let query = supabaseMaster
      .from('pending_signals')
      .select('id, dossier_ref, payload, confirmed, created_at')
      .eq('payload->>email', email);
    
    // Ajouter le filtre city si ce n'est pas un message centralisé
    if (!isCentralized) {
      query = query.eq('city', targetCity);
    }
    
    // ✅ Correction : Séparer existingSignal (let) et checkError (const)
    const result = await query.maybeSingle();
    const { error: checkError } = result;
    let { data: existingSignal } = result;
    
    if (checkError) {
      throw new Error(`Erreur vérification signal: ${checkError.message}`);
    }
    
    // ✅ NOUVELLE CORRECTION : Si le dossier existe dans GitHub mais pas en base (après purge)
    if (!existingSignal && existingDossierRef) {
      console.log(`🔄 submitContact: dossier ${existingDossierRef} trouvé dans GitHub mais pas en base, tentative de restauration...`);
      
      try {
        const restoreUrl = `${siteUrl}/api/archive-external/restore`;
        const restoreRes = await fetch(restoreUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dossier_ref: existingDossierRef,
            city_code: targetCity,
            country_code: targetCountry
          })
        });
        
        if (restoreRes.ok) {
          console.log(`✅ submitContact: dossier ${existingDossierRef} restauré depuis GitHub`);
          
          // Re-vérifier si le signal existe maintenant après restauration
          const restoredResult = await query.maybeSingle();
          const restoredSignal = restoredResult.data;
          if (restoredSignal) {
            existingSignal = restoredSignal;
            console.log(`✅ submitContact: signal restauré trouvé pour ${existingDossierRef}`);
          } else {
            console.warn(`⚠️ submitContact: restauration effectuée mais signal non trouvé pour ${existingDossierRef}`);
          }
        } else {
          const restoreError = await restoreRes.text();
          console.error(`❌ submitContact: échec restauration ${existingDossierRef}: ${restoreError}`);
        }
      } catch (restoreErr) {
        console.error(`❌ submitContact: exception restauration ${existingDossierRef}:`, restoreErr);
      }
    }
    
    if (existingSignal) {
      // ✅ Enrichir l'historique sans écraser
      const existingPayload = existingSignal.payload as SignalPayload;
      const messagesHistory = [...(existingPayload.messages_history || [])];
      
      // Ajouter le message actuel à l'historique s'il n'y est pas déjà
      const currentMessage = existingPayload.message;
      if (currentMessage && messagesHistory.length === 0) {
        messagesHistory.push({
          content: currentMessage,
          created_at: existingSignal.created_at || new Date().toISOString()
        });
      }
      
      // Vérifier si le nouveau message n'est pas déjà dans l'historique
      const alreadyExists = messagesHistory.some(
        (msg) => msg.content === message
      );
      
      if (!alreadyExists) {
        messagesHistory.push({
          content: message,
          created_at: new Date().toISOString(),
          file_url: fileUrl || undefined,
          file_key: fileKey || undefined
        });
      }
      
      // ✅ Mise à jour complète du payload
      const updatedPayload: SignalPayload = {
        name: existingPayload.name || name,
        email: email,
        phone: existingPayload.phone || phone,
        subject: subject,
        message: message,
        city: registryEntry?.city || targetCity,
        country: registryEntry?.country || targetCountry,
        messages_history: messagesHistory,
        file_url: fileUrl || existingPayload.file_url,
        file_key: fileKey || existingPayload.file_key
      };
      
      const { data: updatedData, error: updateError } = await supabaseMaster
        .from('pending_signals')
        .update({
          is_read: false,
          confirmed: false,
          payload: updatedPayload
        })
        .eq('id', existingSignal.id)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Erreur mise à jour signal: ${updateError.message}`);
      }
      insertData = updatedData;
      
    } else {
      // Création d'un nouveau signal (premier message)
      const messagesHistoryEntry = [];
      
      // Ajouter le message initial avec éventuellement le fichier
      messagesHistoryEntry.push({
        content: message,
        created_at: new Date().toISOString(),
        file_url: fileUrl || undefined,
        file_key: fileKey || undefined
      });
      
      const insertPayload: SignalPayload = { 
        name, email, phone, subject, message,
        city: registryEntry?.city || targetCity,
        country: registryEntry?.country || targetCountry,
        messages_history: messagesHistoryEntry,
        file_url: fileUrl || undefined,
        file_key: fileKey || undefined
      };
      
      const { data: newData, error: dbError } = await supabaseMaster
        .from('pending_signals')
        .insert([{
          id: randomUUID(), 
          dossier_ref,
          confirmed: false,
          payload: insertPayload,
          is_new_athlete: !registryEntry && isNewDossier,
          is_read: false,
          city: targetCity,
          country: targetCountry
        }])
        .select()
        .single();

      if (dbError) {
        throw new Error(`Erreur insertion signal: ${dbError.message}`);
      }
      insertData = newData;
    }

    // 6. ENVOI DE L'EMAIL
    const confirmLink = `${siteUrl}/api/confirm-signal?service=${encodeURIComponent(subject)}&city=${targetCity}&country=${targetCountry}&id=${insertData.id}`;

    // ✅ Ajout de la pièce jointe dans l'email si présente
    const fileAttachmentHtml = fileUrl ? `
      <div style="margin-top:15px; padding:10px; border:1px solid #dc2626; background:#09090b; border-radius:8px;">
        <p style="font-size:9px; color:#dc2626; text-transform:uppercase; margin-bottom:5px;">Pièce jointe :</p>
        <a href="${fileUrl}" style="color:#dc2626; font-size:10px; word-break:break-all;">${fileUrl}</a>
      </div>
    ` : '';

    const htmlContent = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          Protocole <span style="color:#dc2626;">Sécurisé</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Référence Dossier : ${dossier_ref}
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px; text-align:left;">
          <p style="font-size:9px; color:#71717a; text-transform:uppercase; margin-bottom:10px;">Message à valider :</p>
          <p style="font-size:12px; font-style:italic; color:#a1a1aa;">"${message}"</p>
          ${fileAttachmentHtml}
        </div>
        <a href="${confirmLink}" style="background:#dc2626; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px;">
          ACTIVER LA TRANSMISSION
        </a>
        <p style="margin-top:30px; font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
          Cet email est généré automatiquement.
        </p>
      </div>
    `;

    const textContent = `Protocole Sécurisé - Référence Dossier: ${dossier_ref}\n\nMessage à valider: "${message}"\n${fileUrl ? `\nPièce jointe: ${fileUrl}\n` : ''}\nActivez votre transmission ici: ${confirmLink}`;

    try {
      await sendGeneralEmail(
        email,
        "ACTION REQUISE : Confirmez votre signal",
        textContent,
        htmlContent,
        "contact@vagondys.com"
      );
    } catch {
      // Non bloquant
    }

  } catch (error) {
    const err = error as Error;
    redirect(`/contact?status=error&message=${encodeURIComponent(err.message)}`);
  }

  redirect("/contact?status=pending_validation"); 
}

/**
 * ACTION 2 : Envoi d'une réponse (Espace Client/Discussion)
 * ✅ CORRECTION : Plus d'insertion dans communication_replies pour les messages client
 * Les messages client sont déjà stockés dans messages_history, pas besoin de dupliquer
 * ✅ AJOUT : Gestion des fichiers joints
 */
export async function submitReply(formData: FormData) {
  const dossier_ref = String(formData.get("dossier_ref") || "").trim();
  const content = String(formData.get("message") || "").trim();
  // Variables conservées pour l'API mais non utilisées directement dans cette version
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cityParam = String(formData.get("city") || "NANTES").trim().toUpperCase();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const countryParam = String(formData.get("country") || "FR").trim().toUpperCase();
  
  // ✅ Récupération des champs fichier
  const fileUrl = String(formData.get("file_url") || "").trim();
  const fileKey = String(formData.get("file_key") || "").trim();

  if (!dossier_ref || !content) throw new Error("Données manquantes.");

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }
    
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // ✅ Récupérer le signal existant pour mettre à jour messages_history
    const { data: existingSignal } = await supabaseClient
      .from('pending_signals')
      .select('payload, dossier_ref')
      .eq('dossier_ref', dossier_ref)
      .maybeSingle();
    
    if (existingSignal && existingSignal.payload) {
      const existingPayload = existingSignal.payload as SignalPayload;
      const messagesHistory = [...(existingPayload.messages_history || [])];
      
      // Vérifier si le message n'est pas déjà dans l'historique
      const alreadyExists = messagesHistory.some(
        (msg) => msg.content === content
      );
      
      if (!alreadyExists) {
        messagesHistory.push({
          content: content,
          created_at: new Date().toISOString(),
          file_url: fileUrl || undefined,
          file_key: fileKey || undefined
        });
      }
      
      const updatedPayload = {
        ...existingPayload,
        message: content,
        messages_history: messagesHistory,
        file_url: fileUrl || existingPayload.file_url,
        file_key: fileKey || existingPayload.file_key
      };
      
      // Mettre à jour le payload avec l'historique
      await supabaseClient
        .from('pending_signals')
        .update({ payload: updatedPayload })
        .eq('dossier_ref', dossier_ref);
      
      console.log(`✅ submitReply: payload mis à jour avec historique (${messagesHistory.length} messages)`);
    }
    
    // ✅ NOTE : On n'insert PLUS dans communication_replies pour les messages client
    // Les réponses staff sont gérées par send-reply/route.ts
    
    return { success: true };
    
  } catch {
    return { success: false, error: "Transmission échouée" };
  }
}

/**
 * ACTION 3 : Envoi du formulaire d'inscription (Staff vers Joueur)
 */
export async function sendInvitation(email: string) {
  if (!email) throw new Error("Email requis.");

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vagondys.com";
    const inscriptionLink = `${baseUrl}/inscription`;

    const htmlContent = `
      <div style="background:black; color:white; padding:40px; font-family:sans-serif; text-align:center;">
        <h1 style="font-size:18px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; font-style:italic;">
          CELLULE <span style="color:#dc2626;">D'ENRÔLEMENT</span>
        </h1>
        <p style="font-size:10px; color:#52525b; text-transform:uppercase; letter-spacing:2px; margin-bottom:30px;">
          Accès au formulaire officiel
        </p>
        <div style="margin-bottom:30px; padding:20px; border:1px solid #18181b; background:#09090b; border-radius:12px;">
           <p style="font-size:12px; color:#a1a1aa; line-height:1.6;">
             Veuillez cliquer sur le bouton ci-dessous pour finaliser votre dossier d'inscription sur la plateforme VAGONDYS.
           </p>
        </div>
        <a href="${inscriptionLink}" style="background:#dc2626; color:white; padding:20px 40px; text-decoration:none; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:3px; border-radius:8px; display:inline-block;">
          Ouvrir le formulaire
        </a>
        <p style="margin-top:40px; font-size:8px; color:#3f3f46; text-transform:uppercase; letter-spacing:1px;">
          VAGONDYS - SYSTÈME DE GESTION DES ATHLÈTES
        </p>
      </div>
    `;

    const textContent = `CELLULE D'ENRÔLEMENT\n\nAccès au formulaire officiel\n\nOuvrir le formulaire: ${inscriptionLink}`;

    const emailResult = await sendGeneralEmail(
      email,
      "FORMULAIRE D'INSCRIPTION - VAGONDYS",
      textContent,
      htmlContent,
      "contact@vagondys.com"
    );

    if (!emailResult.messageId) throw new Error("Erreur d'envoi");
    return { success: true };

  } catch {
    return { success: false, error: "L'envoi a échoué" };
  }
}
