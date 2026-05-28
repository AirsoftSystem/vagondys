
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email/gmail'
import { registerAthlete } from '@/lib/supabase/master'

/**
 * Route serveur sécurisée :
 * - Vérifie le token Cloudflare Turnstile
 * - Inscrit l'athlète dans l'annuaire central (MASTER)
 * - Crée l'utilisateur (email_confirm: false) sur la DB UNIQUE
 * - Génère un token de confirmation et l'envoie par email
 * - Insère dans 'athletes' local avec status: "EN_ATTENTE"
 * - Archive le dossier sur le repo GitHub UNIQUE
 * Version adaptée pour l'Option B (un seul projet Supabase + un seul repo GitHub)
 */

interface SupabaseAuthResponse {
  data: {
    user: { id: string } | null;
  };
  error: { message: string } | null;
}

function extractUserIdFromCreateResponse(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  
  const anyRes = res as Record<string, unknown>;

  if (anyRes.data && typeof anyRes.data === 'object') {
    const data = anyRes.data as Record<string, unknown>;
    if (data.user && typeof data.user === 'object') {
      const user = data.user as Record<string, unknown>;
      if (typeof user.id === 'string') return user.id;
      
      const nestedUser = user.user as Record<string, unknown>;
      if (nestedUser && typeof nestedUser === 'object' && typeof nestedUser.id === 'string') {
        return nestedUser.id;
      }
    }
  }

  if (anyRes.user && typeof anyRes.user === 'object') {
    const user = anyRes.user as Record<string, unknown>;
    if (typeof user.id === 'string') return user.id;
  }

  if (typeof anyRes.id === 'string') return anyRes.id;

  if (anyRes.data && typeof anyRes.data === 'object') {
    const data = anyRes.data as Record<string, unknown>;
    if (typeof data.id === 'string') return data.id;
  }

  return null;
}

/**
 * Générateur de matricule temporaire pour l'archive d'inscription
 */
function generateVGDReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const gen = (source: string, len: number) => 
    Array.from({ length: len }, () => source[Math.floor(Math.random() * source.length)]).join('');
  return `VGD-${gen(chars, 1)}${gen(nums, 1)}${gen(chars, 2)}${gen(nums, 2)}`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const full_name = String(form.get('full_name') ?? '').trim();
    const city = String(form.get('city') ?? 'Nantes').trim();
    const pseudo = ((): string | null => {
      const p = form.get('pseudo');
      if (p === null) return null;
      const s = String(p).trim();
      return s.length ? s : null;
    })();
    const phone = ((): string | null => {
      const p = form.get('phone');
      if (p === null) return null;
      const s = String(p).trim();
      return s.length ? s : null;
    })();
    const turnstileToken = String(form.get('turnstileToken') ?? '');

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Champs manquants (email / password / full_name).' }, { status: 400 });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: "SÉCURITÉ SERVEUR : Le mot de passe ne respecte pas les critères (8 caractères, Maj, Min, Chiffre, Symbole)." },
        { status: 400 }
      );
    }

    // 1. Validation Turnstile
    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
    if (!TURNSTILE_SECRET) {
      return NextResponse.json({ error: 'Configuration Turnstile manquante coté serveur.' }, { status: 500 });
    }

    if (!turnstileToken) {
      return NextResponse.json({ error: 'Token Turnstile manquant.' }, { status: 400 });
    }

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: turnstileToken
      })
    });

    const verifyJson = await verifyRes.json().catch(() => ({ success: false }));
    if (!verifyJson || !verifyJson.success) {
      return NextResponse.json({ error: 'Échec validation anti-bot (Turnstile).' }, { status: 400 });
    }

    // --- LOGIQUE OPTION B (Un seul projet Supabase) ---
    
    // Récupération des variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Variables Supabase manquantes");
      return NextResponse.json({ error: "Configuration serveur invalide" }, { status: 500 });
    }
    
    // Client Admin UNIQUE (Option B)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // A. Inscription obligatoire dans l'annuaire central (MASTER)
    try {
      await registerAthlete(email.toLowerCase(), city, full_name);
    } catch (regErr: unknown) {
      const msg = regErr instanceof Error ? regErr.message : "Erreur Inconnue MASTER";
      return NextResponse.json({ error: `Erreur Annuaire Central: ${msg}` }, { status: 400 });
    }

    // 3. Création du user Auth dans la base UNIQUE
    const createUserRes = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      user_metadata: {
        full_name,
        pseudo: pseudo || null,
        city: city.toUpperCase()
      },
      email_confirm: false 
    }) as unknown as SupabaseAuthResponse;

    let authErrorMessage: string | null = null;
    if (createUserRes?.error) {
      authErrorMessage = createUserRes.error.message;
    }

    const userId = extractUserIdFromCreateResponse(createUserRes);
    if (authErrorMessage || !userId) {
      const msg = authErrorMessage || 'Erreur création utilisateur Auth.';
      throw new Error(String(msg));
    }

    // 4. Insertion table 'athletes' dans la base UNIQUE
    const { error: dbError } = await supabaseAdmin
      .from('athletes')
      .insert([{
        id: userId,
        email: email.toLowerCase(),
        full_name,
        pseudo: pseudo || null,
        phone: phone || null,
        city: city.toUpperCase(),
        country: "FR",
        status: "EN_ATTENTE",
        rank: "RECRUE",
        points: 0,
        total_matches: 0,
        total_score: 0,
        total_shots: 0,
        total_kills: 0,
        total_deaths: 0,
        total_assists: 0,
        total_hits_head: 0,
        total_hits_body: 0,
        total_hits_legs: 0,
        current_grade_id: 1,
        precision_progress: 0,
        current_cycle_shot_count: 0,
        current_cycle_precision: 0,
        documents_urls: []
      }]);

    if (dbError) {
      // Cleanup Auth si erreur DB
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw dbError;
    }

    // 5. Gestion du Token de Confirmation Email
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: tokenError } = await supabaseAdmin
      .from('email_confirmations')
      .insert([{
        user_id: userId,
        email: email.toLowerCase(),
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
        used: false
      }]);

    if (tokenError) {
      console.error("Erreur stockage token confirmation:", tokenError.message);
    }

    // 6. Préparation des références
    const dossierRef = generateVGDReference();
    const targetBase = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://vagondys.com";
    const confirmUrl = `${targetBase}/api/confirm-email?token=${verificationToken}`;

    // 7. Envoi de l'email de vérification
    try {
      await sendVerificationEmail(
        email.toLowerCase(), 
        confirmUrl, 
        full_name, 
        city, 
        "CELLULE D'ENRÔLEMENT"
      );
    } catch (mailErr) {
      console.error("Erreur envoi email de vérification:", mailErr);
    }

    // 8. Archivage GitHub sur le repo UNIQUE
    const dossierMessage = {
      id: userId,
      created_at: new Date().toISOString(),
      dossier_ref: dossierRef,
      confirmed: false,
      payload: {
        meta: {
          created_at: new Date().toISOString(),
          first_contact: true,
          is_resurrected: false,
          is_returning_client: false,
          city: city.toUpperCase()
        },
        name: full_name,
        pseudo: pseudo || null,
        email: email.toLowerCase(),
        phone: phone || null,
        message: `Inscription Joueur - Station: ${city.toUpperCase()} (En attente confirmation email)`,
        subject: "inscription",
        original_subject: "INSCRIPTION",
        city: city.toUpperCase(),
        country: "FR"
      },
      is_read: false
    };

    try {
      const baseUrl = new URL(request.url).origin;
      await fetch(`${baseUrl}/api/archive-external`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: dossierMessage,
          history: [],
          purgeActive: false,
          city_code: city.toUpperCase(),
          country_code: "FR"
        })
      });
    } catch (archErr) {
      console.error('Erreur archivage GitHub inscription:', archErr);
    }

    return NextResponse.json({
      success: true,
      userId,
      dossierRef,
      message: "INSCRIPTION RÉUSSIE. VEUILLEZ CONFIRMER VOTRE EMAIL POUR ACTIVER VOTRE MATRICULE."
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue";
    console.error('register-athlete error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
