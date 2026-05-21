// lib/rate-limit.ts
interface RateLimitConfig {
  interval: number; // en millisecondes
  uniqueTokenPerInterval: number; // nombre maximum de tokens uniques
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Rate limiting simple mais efficace pour les Server Actions
 * Stockage en mémoire (suffisant pour Vercel)
 */
export function rateLimit(config: RateLimitConfig) {
  const { interval, uniqueTokenPerInterval } = config;

  /**
   * Nettoie les entrées expirées pour éviter les fuites mémoire
   */
  const cleanup = () => {
    const now = Date.now();
    Object.keys(store).forEach(key => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  };

  return {
    /**
     * Vérifie si une requête est autorisée
     * @param token Identifiant unique (généralement l'IP)
     * @param limit Limite spécifique pour cette action (optionnelle)
     * @returns boolean true si autorisé, false si rate limit dépassé
     */
    check: (token: string, limit?: number): boolean => {
      const now = Date.now();
      const maxRequests = limit || uniqueTokenPerInterval;
      
      // Nettoyage périodique (une fois sur 10 appels environ)
      if (Math.random() < 0.1) {
        cleanup();
      }

      // Initialiser ou récupérer l'entrée
      if (!store[token]) {
        store[token] = { count: 0, resetTime: now + interval };
      }

      // Si le délai est expiré, réinitialiser
      if (store[token].resetTime < now) {
        store[token] = { count: 0, resetTime: now + interval };
      }

      // Vérifier la limite
      if (store[token].count >= maxRequests) {
        return false;
      }

      // Incrémenter le compteur
      store[token].count++;
      return true;
    },

    /**
     * Récupère le temps de réinitialisation pour un token
     */
    getResetTime: (token: string): number | null => {
      return store[token]?.resetTime || null;
    },

    /**
     * Récupère le nombre de requêtes restantes
     */
    getRemaining: (token: string, limit?: number): number => {
      const maxRequests = limit || uniqueTokenPerInterval;
      if (!store[token]) return maxRequests;
      return Math.max(0, maxRequests - store[token].count);
    }
  };
}

/**
 * Usage example:
 * 
 * const limiter = rateLimit({
 *   interval: 60 * 1000, // 1 minute
 *   uniqueTokenPerInterval: 500
 * });
 * 
 * const isAllowed = limiter.check(ip, 10); // 10 requêtes max par minute
 */
