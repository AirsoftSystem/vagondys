
// app/api/player/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PlayerDB, type PlayerProfile } from "@/lib/github-db/player";
import { createClient } from "@supabase/supabase-js";

// ==========================================================
// CONFIGURATION
// ==========================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ==========================================================
// TYPES
// ==========================================================

interface UserMetadata {
  full_name?: string;
  pseudo?: string;
  city?: string;
  country?: string;
  role?: string;
  [key: string]: unknown;
}

interface AuthResult {
  userId: string;
  email: string;
  isStaff: boolean;
  userMetadata?: UserMetadata;
}

// ==========================================================
// UTILITAIRES
// ==========================================================

/**
 * Vérifier l'authentification d'un utilisateur (joueur ou staff)
 * ✅ CORRIGÉ : Type 'any' remplacé par 'UserMetadata'
 */
async function authenticateUser(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!token) {
    return null;
  }
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Variables Supabase manquantes");
    return null;
  }
  
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  
  if (error || !user) {
    // Vérifier si c'est un token STAFF temporaire (pour Python)
    try {
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const payload = JSON.parse(decoded);
      if (payload.player_id && payload.exp && payload.exp > Date.now()) {
        return { 
          userId: payload.player_id, 
          email: payload.email || "",
          isStaff: false,
          userMetadata: { city: payload.city, country: payload.country }
        };
      }
    } catch {
      // Token invalide
    }
    return null;
  }
  
  const isStaff = user.user_metadata?.role === "staff" || 
                  user.email?.includes("staff") ||
                  user.email === "vagondys@gmail.com";
  
  return { 
    userId: user.id, 
    email: user.email || "",
    isStaff,
    userMetadata: user.user_metadata as UserMetadata | undefined
  };
}

/**
 * Vérifier qu'un utilisateur a accès aux données d'un joueur
 */
async function canAccessPlayerData(requesterId: string, targetPlayerId: string, isStaff: boolean): Promise<boolean> {
  if (isStaff) return true;
  return requesterId === targetPlayerId;
}

/**
 * Valider les champs du profil (sécurité)
 */
function validateProfileFields(updates: Partial<PlayerProfile>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedFields = [
    'full_name', 'pseudo', 'city', 'country', 'email',
    'current_rank', 'current_grade_id', 'precision_progress',
    'current_cycle_shot_count', 'current_cycle_precision'
  ];
  
  for (const key of Object.keys(updates)) {
    if (!allowedFields.includes(key)) {
      errors.push(`Le champ "${key}" n'est pas modifiable directement`);
    }
  }
  
  // Validation spécifique
  if (updates.pseudo && (updates.pseudo.length < 3 || updates.pseudo.length > 30)) {
    errors.push("Le pseudo doit contenir entre 3 et 30 caractères");
  }
  
  if (updates.full_name && updates.full_name.length < 2) {
    errors.push("Le nom complet doit contenir au moins 2 caractères");
  }
  
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    errors.push("L'email n'est pas valide");
  }
  
  if (updates.current_grade_id && (updates.current_grade_id < 1 || updates.current_grade_id > 24)) {
    errors.push("Le grade ID doit être entre 1 et 24");
  }
  
  if (updates.precision_progress !== undefined && (updates.precision_progress < 0 || updates.precision_progress > 100)) {
    errors.push("La progression de précision doit être entre 0 et 100");
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Créer une copie de profil sans email (pour les non-staff)
 * ✅ CORRIGÉ : Évite l'opérateur 'delete' qui pose problème avec TypeScript
 */
function createPublicProfile(profile: PlayerProfile): Omit<PlayerProfile, 'email'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { email, ...publicProfile } = profile;
  return publicProfile;
}

// ==========================================================
// GET - Récupérer le profil d'un joueur
// ==========================================================
export async function GET(request: NextRequest) {
  try {
    // 1. Authentification
    const auth = await authenticateUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    // 2. Paramètres de requête
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get("playerId");
    
    // 3. Déterminer le joueur cible
    const targetPlayerId = playerId || auth.userId;
    
    // 4. Vérifier les droits d'accès
    if (!await canAccessPlayerData(auth.userId, targetPlayerId, auth.isStaff)) {
      return NextResponse.json(
        { error: "Accès non autorisé à ce joueur" },
        { status: 403 }
      );
    }
    
    // 5. Récupérer le profil
    let profile = await PlayerDB.getProfile(targetPlayerId);
    
    // 6. Si le profil n'existe pas encore (nouveau joueur), le créer
    if (!profile) {
      // Récupérer les infos depuis Supabase si disponibles
      if (supabaseUrl && supabaseAnonKey) {
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: userData } = await supabaseClient.auth.getUser();
        
        const newProfile: PlayerProfile = {
          id: targetPlayerId,
          email: auth.email || userData?.user?.email || "",
          full_name: auth.userMetadata?.full_name || "",
          pseudo: auth.userMetadata?.pseudo || `Joueur_${targetPlayerId.slice(0, 8)}`,
          city: auth.userMetadata?.city || "NANTES",
          country: auth.userMetadata?.country || "FR",
          dossier_ref: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          total_matches: 0,
          total_score: 0,
          total_shots: 0,
          total_kills: 0,
          total_deaths: 0,
          total_assists: 0,
          total_hits_head: 0,
          total_hits_body: 0,
          total_hits_legs: 0,
          current_rank: "Guerrier I",
          current_grade_id: 1,
          precision_progress: 0,
          current_cycle_shot_count: 0,
          current_cycle_precision: 0,
        };
        
        await PlayerDB.createProfile(newProfile);
        profile = newProfile;
      } else {
        return NextResponse.json(
          { error: "Profil non trouvé" },
          { status: 404 }
        );
      }
    }
    
    // 7. Ne pas exposer les données sensibles si c'est un staff qui consulte
    // ✅ CORRIGÉ : Utilisation de createPublicProfile au lieu de delete
    const responseProfile = (!auth.isStaff && auth.userId !== targetPlayerId) 
      ? createPublicProfile(profile)
      : profile;
    
    // 8. Retourner le profil
    return NextResponse.json({
      success: true,
      profile: responseProfile,
    });
    
  } catch (error) {
    console.error("GET /api/player/profile error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// ==========================================================
// PUT - Mettre à jour le profil d'un joueur
// ==========================================================
export async function PUT(request: NextRequest) {
  try {
    // 1. Authentification
    const auth = await authenticateUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    // 2. Récupérer le body
    const body = await request.json();
    const { playerId, updates } = body;
    
    // 3. Déterminer le joueur cible
    const targetPlayerId = playerId || auth.userId;
    
    // 4. Vérifier les droits d'accès (seul le joueur lui-même ou le staff peut modifier)
    if (!await canAccessPlayerData(auth.userId, targetPlayerId, auth.isStaff)) {
      return NextResponse.json(
        { error: "Accès non autorisé pour modifier ce profil" },
        { status: 403 }
      );
    }
    
    // 5. Validation des champs
    const validation = validateProfileFields(updates);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.errors },
        { status: 400 }
      );
    }
    
    // 6. Récupérer le profil existant
    const existingProfile = await PlayerDB.getProfile(targetPlayerId);
    if (!existingProfile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }
    
    // 7. Empêcher la modification de champs critiques (sauf pour staff)
    const safeUpdates = { ...updates };
    if (!auth.isStaff) {
      // Un joueur normal ne peut pas modifier ces champs
      delete safeUpdates.total_matches;
      delete safeUpdates.total_score;
      delete safeUpdates.total_shots;
      delete safeUpdates.total_kills;
      delete safeUpdates.total_deaths;
      delete safeUpdates.total_assists;
      delete safeUpdates.total_hits_head;
      delete safeUpdates.total_hits_body;
      delete safeUpdates.total_hits_legs;
      delete safeUpdates.dossier_ref;
      delete safeUpdates.created_at;
    }
    
    // 8. Appliquer les mises à jour
    const success = await PlayerDB.updateProfile(targetPlayerId, safeUpdates);
    
    if (!success) {
      return NextResponse.json(
        { error: "Échec de la mise à jour du profil" },
        { status: 500 }
      );
    }
    
    // 9. Récupérer le profil mis à jour
    const updatedProfile = await PlayerDB.getProfile(targetPlayerId);
    
    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Profil non trouvé après mise à jour" },
        { status: 404 }
      );
    }
    
    // 10. Ne pas exposer l'email si c'est un staff qui consulte
    // ✅ CORRIGÉ : Utilisation de createPublicProfile au lieu de delete
    const responseProfile = (!auth.isStaff && auth.userId !== targetPlayerId)
      ? createPublicProfile(updatedProfile)
      : updatedProfile;
    
    // 11. Retourner la confirmation
    return NextResponse.json({
      success: true,
      message: "Profil mis à jour avec succès",
      profile: responseProfile,
    });
    
  } catch (error) {
    console.error("PUT /api/player/profile error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// ==========================================================
// OPTIONS - Gérer les requêtes CORS (optionnel)
// ==========================================================
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
