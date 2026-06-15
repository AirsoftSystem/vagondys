
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Types pour la réponse
interface AthleteData {
  name: string;
  email: string;
  phone: string;
  dossier_ref: string;
  city: string;
  country: string;
  last_message: string;
  messages_history?: Array<{
    content: string;
    created_at: string;
  }>;
  created_at: string;
}

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
  }>;
}

/**
 * GET /api/get-athlete-data/[dossier]
 * 
 * Récupère les données d'un athlète/joueur à partir de sa référence dossier
 * Utilisé par le bouton ReplyButton pour le pré-remplissage automatique
 * 
 * @param dossier - Référence du dossier (ex: VGD-ABCD1234)
 * @returns AthleteData ou erreur 404
 * 
 * @example
 * // Requête
 * GET /api/get-athlete-data/VGD-ABCD1234
 * 
 * // Réponse succès (200)
 * {
 *   "name": "Martin Jean",
 *   "email": "martin@example.com",
 *   "phone": "+33612345678",
 *   "dossier_ref": "VGD-ABCD1234",
 *   "city": "NANTES",
 *   "country": "FR",
 *   "last_message": "Bonjour, je souhaite participer au prochain tournoi...",
 *   "messages_history": [...],
 *   "created_at": "2024-01-15T10:30:00Z"
 * }
 * 
 * // Réponse erreur (404)
 * {
 *   "error": "Dossier non trouvé"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { dossier: string } }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Vérification des variables d'environnement
  if (!supabaseUrl || !supabaseKey) {
    console.error('[API get-athlete-data] Configuration Supabase manquante');
    return NextResponse.json(
      { error: 'Configuration serveur manquante' },
      { status: 500 }
    );
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { dossier } = params;
  
  // Validation du paramètre dossier
  if (!dossier || typeof dossier !== 'string') {
    return NextResponse.json(
      { error: 'Paramètre dossier invalide' },
      { status: 400 }
    );
  }
  
  console.log(`[API get-athlete-data] Recherche du dossier: ${dossier}`);
  
  try {
    // 1. Recherche dans pending_signals
    const { data: signal, error: signalError } = await supabase
      .from('pending_signals')
      .select('payload, dossier_ref, city, country, created_at')
      .eq('dossier_ref', dossier)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!signalError && signal) {
      const payload = signal.payload as SignalPayload;
      
      console.log(`[API get-athlete-data] Dossier trouvé dans pending_signals: ${dossier}`);
      
      return NextResponse.json({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        dossier_ref: signal.dossier_ref,
        city: signal.city,
        country: signal.country,
        last_message: payload.message,
        messages_history: payload.messages_history || [],
        created_at: signal.created_at
      } as AthleteData);
    }
    
    // 2. Recherche dans athletes_registry
    const { data: registry, error: registryError } = await supabase
      .from('athletes_registry')
      .select('email, dossier_ref, city, country')
      .eq('dossier_ref', dossier)
      .maybeSingle();
    
    if (!registryError && registry) {
      console.log(`[API get-athlete-data] Dossier trouvé dans athletes_registry: ${dossier}`);
      
      // Chercher le dernier message dans pending_signals avec cet email
      const { data: lastSignal } = await supabase
        .from('pending_signals')
        .select('payload')
        .eq('payload->>email', registry.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const payload = lastSignal?.payload as SignalPayload | null;
      
      return NextResponse.json({
        name: payload?.name || '',
        email: registry.email,
        phone: payload?.phone || '',
        dossier_ref: registry.dossier_ref,
        city: registry.city,
        country: registry.country,
        last_message: payload?.message || '',
        messages_history: payload?.messages_history || [],
        created_at: new Date().toISOString()
      } as AthleteData);
    }
    
    // 3. Recherche dans athletes (table principale)
    const { data: athlete, error: athleteError } = await supabase
      .from('athletes')
      .select('email, dossier_ref, full_name, phone, city, country')
      .eq('dossier_ref', dossier)
      .maybeSingle();
    
    if (!athleteError && athlete) {
      console.log(`[API get-athlete-data] Dossier trouvé dans athletes: ${dossier}`);
      
      return NextResponse.json({
        name: athlete.full_name,
        email: athlete.email,
        phone: athlete.phone || '',
        dossier_ref: athlete.dossier_ref,
        city: athlete.city,
        country: athlete.country,
        last_message: '',
        messages_history: [],
        created_at: new Date().toISOString()
      } as AthleteData);
    }
    
    // 4. Aucun dossier trouvé
    console.log(`[API get-athlete-data] Dossier non trouvé: ${dossier}`);
    return NextResponse.json(
      { error: 'Dossier non trouvé' },
      { status: 404 }
    );
    
  } catch (error) {
    console.error('[API get-athlete-data] Erreur inattendue:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
