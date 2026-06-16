
// lib/hooks/useDashboardData.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ==========================================================
// TYPES
// ==========================================================

interface GlobalStats {
  totalAthletes: number;
  totalCities: number;
  totalStaff: number;
  totalMessages: number;
  pendingMessagerieRequests: number;
  activeAthletes: number;
  newAthletesThisMonth: number;
}

interface CityStats {
  name: string;
  country: string;
  athletes: number;
  active: number;
  messages: number;
}

interface Activity {
  id: string;
  type: "message" | "game_launch" | "match";
  title: string;
  description: string;
  timestamp: string;
  link: string;
}

interface TopPlayer {
  id: string;
  pseudo: string;
  full_name: string;
  points: number;
  rank: string;
  matchesPlayed: number;
  winRate: number;
}

interface DashboardData {
  global: GlobalStats;
  cities: CityStats[];
  totalAthletes: number;
  activeAthletes: number;
  pendingMessages: number;
  totalGameLaunches: number;
  recentActivities: Activity[];
  topPlayers: TopPlayer[];
}

interface UseDashboardDataOptions {
  /** Ville de l'agent (MASTER pour super admin) */
  city: string;
  /** Pays de l'agent */
  country?: string;
  /** Intervalle de polling en millisecondes (défaut: 5000) */
  pollingInterval?: number;
  /** Activer le polling automatique (défaut: true) */
  autoPolling?: boolean;
  /** Activer le son lors des changements (défaut: true) */
  soundEnabled?: boolean;
  /** Callback appelé lors des changements de données */
  onDataChange?: (data: DashboardData, previousData: DashboardData | null) => void;
}

interface UseDashboardDataReturn {
  /** Données du dashboard */
  data: DashboardData | null;
  /** État de chargement */
  loading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Dernière mise à jour */
  lastUpdate: Date | null;
  /** Force le rechargement des données */
  refresh: () => Promise<void>;
  /** Active/désactive le polling */
  setPollingEnabled: (enabled: boolean) => void;
  /** Indique si le polling est actif */
  isPolling: boolean;
  /** Active/désactive le son */
  setSoundEnabled: (enabled: boolean) => void;
  /** Indique si le son est actif */
  isSoundEnabled: boolean;
  /** Joue un son de notification */
  playNotificationSound: () => void;
}

// ==========================================================
// HOOK
// ==========================================================

export function useDashboardData({
  city,
  country = "FR",
  pollingInterval = 5000,
  autoPolling = true,
  soundEnabled: initialSoundEnabled = true,
  onDataChange,
}: UseDashboardDataOptions): UseDashboardDataReturn {
  // États principaux
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(autoPolling);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(initialSoundEnabled);

  // Refs pour la détection de changements et le polling
  const previousDataRef = useRef<DashboardData | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ==========================================================
  // SON - BIP DE NOTIFICATION
  // ==========================================================

  const playNotificationSound = useCallback(() => {
    if (!isSoundEnabled) return;

    // Vérifier si AudioContext est disponible (navigateur)
    if (typeof window === "undefined" || typeof AudioContext === "undefined") {
      return;
    }

    try {
      // Utiliser un AudioContext pour générer un son simple (bip)
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.value = 880; // La3
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);

      // Petit délai pour le second bip
      setTimeout(() => {
        try {
          const audioCtx2 = new AudioContext();
          const oscillator2 = audioCtx2.createOscillator();
          const gainNode2 = audioCtx2.createGain();

          oscillator2.connect(gainNode2);
          gainNode2.connect(audioCtx2.destination);

          oscillator2.frequency.value = 1108.73; // Do#5
          oscillator2.type = "sine";

          gainNode2.gain.setValueAtTime(0.2, audioCtx2.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioCtx2.currentTime + 0.25);

          oscillator2.start(audioCtx2.currentTime);
          oscillator2.stop(audioCtx2.currentTime + 0.25);
        } catch {
          // Ignorer les erreurs du second bip
        }
      }, 150);
    } catch {
      // Fallback: utiliser un fichier audio si disponible
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/sounds/notification-bip.wav");
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {
        // Ignorer les erreurs audio
      }
    }
  }, [isSoundEnabled]);

  // ==========================================================
  // DÉTECTION DES CHANGEMENTS
  // ==========================================================

  const detectChangesAndNotify = useCallback(
    (newData: DashboardData) => {
      const prevData = previousDataRef.current;

      if (!prevData) {
        // Premier chargement, on stocke les données sans notifier
        previousDataRef.current = newData;
        return;
      }

      let hasChanged = false;

      // Comparer les stats globales
      const globalKeys: (keyof GlobalStats)[] = [
        "totalAthletes",
        "totalCities",
        "totalStaff",
        "totalMessages",
        "pendingMessagerieRequests",
        "activeAthletes",
        "newAthletesThisMonth",
      ];

      for (const key of globalKeys) {
        if (prevData.global[key] !== newData.global[key]) {
          hasChanged = true;
          console.log(
            `🔔 [useDashboardData] Changement détecté: ${key} ${prevData.global[key]} → ${newData.global[key]}`
          );
        }
      }

      // Comparer les stats par ville
      const prevCityMap = new Map(prevData.cities.map((c) => [c.name, c]));
      for (const newCity of newData.cities) {
        const prevCity = prevCityMap.get(newCity.name);
        if (prevCity) {
          if (
            prevCity.athletes !== newCity.athletes ||
            prevCity.active !== newCity.active ||
            prevCity.messages !== newCity.messages
          ) {
            hasChanged = true;
            console.log(
              `🔔 [useDashboardData] Changement détecté pour ${newCity.name}: Athlètes ${prevCity.athletes}→${newCity.athletes}, Actifs ${prevCity.active}→${newCity.active}, Messages ${prevCity.messages}→${newCity.messages}`
            );
          }
        } else {
          // Nouvelle ville détectée
          hasChanged = true;
          console.log(`🔔 [useDashboardData] Nouvelle ville détectée: ${newCity.name}`);
        }
      }

      // Mettre à jour la référence
      previousDataRef.current = newData;

      // Jouer le son si des changements ont été détectés
      if (hasChanged) {
        playNotificationSound();
      }

      // Appeler le callback si fourni
      if (onDataChange && hasChanged) {
        onDataChange(newData, prevData);
      }
    },
    [playNotificationSound, onDataChange]
  );

  // ==========================================================
  // CHARGEMENT DES DONNÉES
  // ==========================================================

  const loadData = useCallback(
    async (silent: boolean = false) => {
      if (!city) {
        setError("Ville manquante");
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const url = `/api/staff/dashboard?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Erreur chargement données");
        }

        const newData: DashboardData = {
          global: result.global || {
            totalAthletes: result.totalAthletes || 0,
            totalCities: 0,
            totalStaff: 0,
            totalMessages: result.pendingMessages || 0,
            pendingMessagerieRequests: 0,
            activeAthletes: result.activeAthletes || 0,
            newAthletesThisMonth: 0,
          },
          cities: result.cities || [],
          totalAthletes: result.totalAthletes || 0,
          activeAthletes: result.activeAthletes || 0,
          pendingMessages: result.pendingMessages || 0,
          totalGameLaunches: result.totalGameLaunches || 0,
          recentActivities: result.recentActivities || [],
          topPlayers: result.topPlayers || [],
        };

        if (isMountedRef.current) {
          setData(newData);
          setLastUpdate(new Date());
          detectChangesAndNotify(newData);
          setError(null);
        }
      } catch (err) {
        console.error("[useDashboardData] Erreur loadData:", err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
        }
      } finally {
        if (isMountedRef.current && !silent) {
          setLoading(false);
        }
      }
    },
    [city, country, detectChangesAndNotify]
  );

  // ==========================================================
  // POLLING
  // ==========================================================

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (isPolling) {
      pollingIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          loadData(true); // Chargement silencieux
        }
      }, pollingInterval);
    }
  }, [isPolling, pollingInterval, loadData]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const setPollingEnabled = useCallback(
    (enabled: boolean) => {
      setIsPolling(enabled);
      if (enabled) {
        startPolling();
      } else {
        stopPolling();
      }
    },
    [startPolling, stopPolling]
  );

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setIsSoundEnabled(enabled);
  }, []);

  // ==========================================================
  // EFFETS
  // ==========================================================

  // Chargement initial
  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      await loadData(false);
    };

    init();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadData]);

  // Gestion du polling
  useEffect(() => {
    if (isPolling) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isPolling, startPolling, stopPolling]);

  // Nettoyage final
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // ==========================================================
  // RETOUR
  // ==========================================================

  return {
    data,
    loading,
    error,
    lastUpdate,
    refresh: () => loadData(false),
    setPollingEnabled,
    isPolling,
    setSoundEnabled,
    isSoundEnabled,
    playNotificationSound,
  };
}
