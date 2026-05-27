
/**
 * ==========================================================
 * ARCHIVE VIEWER COMPONENT
 * ==========================================================
 * Affiche et permet de consulter les archives annuelles d'un joueur
 * Intégré dans l'espace joueur
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Archive,
  Download,
  Eye,
  Loader2,
  Trophy,
  Target,
  Activity,
  Users,
  BarChart3,
  X
} from 'lucide-react';

// Types pour les données archivées
interface ArchiveMetadata {
  year: number;
  city: string;
  country: string;
  exists: boolean;
  size?: number;
  recordsCount?: {
    players: number;
    matches: number;
    tournaments: number;
    rankings: number;
    as_eg_sessions: number;
  };
}

interface ArchiveData {
  year: number;
  city: string;
  country: string;
  archived_at: string;
  data: {
    players: PlayerArchiveData[];
    matches: MatchArchiveData[];
    tournaments: TournamentArchiveData[];
    rankings: RankingArchiveData[];
    as_eg_sessions: ASEGSessionArchiveData[];
  };
}

interface PlayerArchiveData {
  id: string;
  email: string;
  full_name: string;
  pseudo: string | null;
  phone: string | null;
  rank: string;
  status: string;
  city: string;
  country: string;
  created_at: string;
  total_score: number;
  total_matches: number;
  total_shots: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

interface MatchArchiveData {
  id: string;
  player_id: string;
  player_name: string;
  date: string;
  duration: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  shots: number;
  hits_head: number;
  hits_body: number;
  hits_legs: number;
  win: boolean;
  game_group: string;
  city: string;
  country: string;
}

interface TournamentArchiveData {
  id: string;
  tournament_name: string;
  tournament_date: string;
  player_id: string;
  player_name: string;
  position: number;
  points_gained: number;
  category: string;
  city: string;
  country: string;
}

interface RankingArchiveData {
  id: string;
  player_id: string;
  player_name: string;
  rank: number;
  previous_rank: number;
  points: number;
  week_start: string;
  week_end: string;
  city: string;
  country: string;
}

interface ASEGSessionArchiveData {
  id: string;
  player_id: string;
  player_name: string;
  session_type: string;
  score: number;
  max_score: number;
  duration_seconds: number;
  created_at: string;
  city: string;
  country: string;
}

interface ArchiveViewerProps {
  playerId: string;
  city: string;
  country?: string;
}

type ViewType = 'metadata' | 'players' | 'matches' | 'tournaments' | 'rankings' | 'as_eg';

// Formatage de la date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Formatage de la taille
const formatSize = (bytes?: number): string => {
  if (!bytes) return 'Inconnu';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Formatage du rang
const formatPosition = (position: number): string => {
  if (position === 1) return '1er';
  return `${position}ème`;
};

// Formatage de la durée
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs.toFixed(0)}s`;
};

export default function ArchiveViewer({
  playerId,
  city,
  country = 'FR'
}: ArchiveViewerProps) {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [archiveData, setArchiveData] = useState<ArchiveData | null>(null);
  const [metadata, setMetadata] = useState<ArchiveMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingYears, setLoadingYears] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('metadata');
  const [showModal, setShowModal] = useState(false);

  /**
   * Récupère la liste des années disponibles
   */
  const fetchAvailableYears = useCallback(async () => {
    if (!playerId || !city) return;
    
    setLoadingYears(true);
    try {
      // Pour l'instant, on vérifie les années N-1, N-2, N-3
      const currentYear = new Date().getFullYear();
      const yearsToCheck = [currentYear - 1, currentYear - 2, currentYear - 3];
      const existingYears: number[] = [];
      
      for (const year of yearsToCheck) {
        const response = await fetch(`/api/archive-year?city=${city}&year=${year}&country=${country}`);
        const result = await response.json();
        
        if (result.success && result.data?.exists) {
          existingYears.push(year);
        }
      }
      
      setAvailableYears(existingYears);
      
      // Sélectionner l'année la plus récente par défaut
      if (existingYears.length > 0 && !selectedYear) {
        setSelectedYear(existingYears[0]);
      }
    } catch (err) {
      console.error('Erreur chargement années:', err);
    } finally {
      setLoadingYears(false);
    }
  }, [playerId, city, country, selectedYear]);

  /**
   * Charge les métadonnées d'une année
   */
  const fetchMetadata = useCallback(async (year: number) => {
    if (!city) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/archive-year?city=${city}&year=${year}&country=${country}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setMetadata(result.data);
        setError(null);
      } else {
        setMetadata(null);
        setError(result.error || 'Archive non trouvée');
      }
    } catch (err) {
      console.error('Erreur chargement métadonnées:', err);
      setError('Erreur lors du chargement des métadonnées');
    } finally {
      setLoading(false);
    }
  }, [city, country]);

  /**
   * Charge le contenu complet d'une archive
   */
  const fetchArchiveContent = useCallback(async (year: number) => {
    if (!city) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/archive-year?city=${city}&year=${year}&country=${country}&action=load`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setArchiveData(result.data);
        setError(null);
      } else {
        setArchiveData(null);
        setError(result.error || 'Archive non trouvée');
      }
    } catch (err) {
      console.error('Erreur chargement archive:', err);
      setError('Erreur lors du chargement de l\'archive');
    } finally {
      setLoading(false);
    }
  }, [city, country]);

  /**
   * Change l'année sélectionnée
   */
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setArchiveData(null);
    setActiveView('metadata');
    fetchMetadata(year);
  };

  /**
   * Charge le contenu complet et change de vue
   */
  const handleLoadContent = async () => {
    if (selectedYear) {
      await fetchArchiveContent(selectedYear);
      setActiveView('players');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAvailableYears();
  }, [fetchAvailableYears]);

  useEffect(() => {
    if (selectedYear) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchMetadata(selectedYear);
    }
  }, [selectedYear, fetchMetadata]);

  if (loadingYears) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
        <span className="ml-2 text-zinc-500 text-xs">Chargement des archives...</span>
      </div>
    );
  }

  if (availableYears.length === 0) {
    return (
      <div className="text-center py-8 border border-zinc-800 rounded-xl bg-zinc-900/20">
        <Archive className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-xs">Aucune archive disponible</p>
        <p className="text-zinc-600 text-[10px] mt-1">Les archives seront disponibles après 1 an</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur d'année */}
      <div className="flex flex-wrap gap-2">
        {availableYears.map((year) => (
          <button
            key={year}
            onClick={() => handleYearChange(year)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              selectedYear === year
                ? 'bg-red-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
            title={`Archives de ${year}`}
            aria-label={`Archives de ${year}`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
          <span className="ml-2 text-zinc-500 text-xs">Chargement...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-500 text-xs">{error}</p>
        </div>
      ) : metadata ? (
        <>
          {/* Métadonnées */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="w-4 h-4 text-red-600" />
              <h3 className="text-[9px] font-black uppercase tracking-wider text-white">
                Archive {metadata.year} - {metadata.city}
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[7px] text-zinc-500 uppercase">Taille</p>
                <p className="text-xs font-bold text-white">{formatSize(metadata.size)}</p>
              </div>
              <div>
                <p className="text-[7px] text-zinc-500 uppercase">Joueurs</p>
                <p className="text-xs font-bold text-white">{metadata.recordsCount?.players || 0}</p>
              </div>
              <div>
                <p className="text-[7px] text-zinc-500 uppercase">Matchs</p>
                <p className="text-xs font-bold text-white">{metadata.recordsCount?.matches || 0}</p>
              </div>
              <div>
                <p className="text-[7px] text-zinc-500 uppercase">Tournois</p>
                <p className="text-xs font-bold text-white">{metadata.recordsCount?.tournaments || 0}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleLoadContent}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-colors text-[9px] font-black uppercase tracking-wider"
              title="Voir le contenu détaillé"
              aria-label="Voir le contenu détaillé"
            >
              <Eye size={12} />
              Voir le contenu
            </button>
            <button
              onClick={() => {/* TODO: Télécharger l'archive */}}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-wider"
              title="Télécharger l'archive"
              aria-label="Télécharger l'archive"
            >
              <Download size={12} />
              Télécharger
            </button>
          </div>

          {/* Navigation des vues */}
          {archiveData && (
            <>
              <div className="flex flex-wrap gap-1 pt-2 border-t border-zinc-800">
                <button
                  onClick={() => setActiveView('players')}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider transition-all ${
                    activeView === 'players'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Joueurs"
                  aria-label="Joueurs"
                >
                  <Users size={10} className="inline mr-1" />
                  Joueurs
                </button>
                <button
                  onClick={() => setActiveView('matches')}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider transition-all ${
                    activeView === 'matches'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Matchs"
                  aria-label="Matchs"
                >
                  <Activity size={10} className="inline mr-1" />
                  Matchs
                </button>
                <button
                  onClick={() => setActiveView('tournaments')}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider transition-all ${
                    activeView === 'tournaments'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Tournois"
                  aria-label="Tournois"
                >
                  <Trophy size={10} className="inline mr-1" />
                  Tournois
                </button>
                <button
                  onClick={() => setActiveView('rankings')}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider transition-all ${
                    activeView === 'rankings'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Classements"
                  aria-label="Classements"
                >
                  <BarChart3 size={10} className="inline mr-1" />
                  Classements
                </button>
                <button
                  onClick={() => setActiveView('as_eg')}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider transition-all ${
                    activeView === 'as_eg'
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                  title="Sessions AS-EG"
                  aria-label="Sessions AS-EG"
                >
                  <Target size={10} className="inline mr-1" />
                  AS-EG
                </button>
              </div>

              {/* Contenu selon la vue active */}
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-xl p-3 max-h-[400px] overflow-y-auto">
                {activeView === 'players' && (
                  <div className="space-y-2">
                    <h4 className="text-[8px] font-black uppercase text-zinc-500 mb-2">
                      Joueurs ({archiveData.data.players.length})
                    </h4>
                    {archiveData.data.players.slice(0, 50).map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg"
                      >
                        <div>
                          <p className="text-[9px] font-bold text-white">{player.pseudo || player.full_name}</p>
                          <p className="text-[7px] text-zinc-500">{player.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-red-500">{player.total_score} pts</p>
                          <p className="text-[7px] text-zinc-500">{player.total_matches} matchs</p>
                        </div>
                      </div>
                    ))}
                    {archiveData.data.players.length > 50 && (
                      <p className="text-[7px] text-zinc-500 text-center pt-2">
                        + {archiveData.data.players.length - 50} autres joueurs
                      </p>
                    )}
                  </div>
                )}

                {activeView === 'matches' && (
                  <div className="space-y-2">
                    <h4 className="text-[8px] font-black uppercase text-zinc-500 mb-2">
                      Matchs ({archiveData.data.matches.length})
                    </h4>
                    {archiveData.data.matches.slice(0, 30).map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg"
                      >
                        <div>
                          <p className="text-[8px] font-bold text-white">{match.player_name}</p>
                          <p className="text-[6px] text-zinc-500">{formatDate(match.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-red-500">{match.score} pts</p>
                          <p className="text-[7px] text-zinc-500">
                            {match.kills}/{match.deaths}/{match.assists}
                          </p>
                        </div>
                      </div>
                    ))}
                    {archiveData.data.matches.length > 30 && (
                      <p className="text-[7px] text-zinc-500 text-center pt-2">
                        + {archiveData.data.matches.length - 30} autres matchs
                      </p>
                    )}
                  </div>
                )}

                {activeView === 'tournaments' && (
                  <div className="space-y-2">
                    <h4 className="text-[8px] font-black uppercase text-zinc-500 mb-2">
                      Tournois ({archiveData.data.tournaments.length})
                    </h4>
                    {archiveData.data.tournaments.slice(0, 30).map((tournament) => (
                      <div
                        key={tournament.id}
                        className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg"
                      >
                        <div>
                          <p className="text-[8px] font-bold text-white">{tournament.tournament_name}</p>
                          <p className="text-[6px] text-zinc-500">{tournament.player_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-red-500">{tournament.points_gained} pts</p>
                          <p className="text-[7px] text-zinc-500">{formatPosition(tournament.position)}</p>
                        </div>
                      </div>
                    ))}
                    {archiveData.data.tournaments.length > 30 && (
                      <p className="text-[7px] text-zinc-500 text-center pt-2">
                        + {archiveData.data.tournaments.length - 30} autres tournois
                      </p>
                    )}
                  </div>
                )}

                {activeView === 'rankings' && (
                  <div className="space-y-2">
                    <h4 className="text-[8px] font-black uppercase text-zinc-500 mb-2">
                      Classements ({archiveData.data.rankings.length})
                    </h4>
                    {archiveData.data.rankings.slice(0, 30).map((ranking) => (
                      <div
                        key={ranking.id}
                        className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg"
                      >
                        <div>
                          <p className="text-[8px] font-bold text-white">{ranking.player_name}</p>
                          <p className="text-[6px] text-zinc-500">
                            Semaine du {formatDate(ranking.week_start)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-red-500">{ranking.points} pts</p>
                          <p className="text-[7px] text-zinc-500">Rang {ranking.rank}</p>
                        </div>
                      </div>
                    ))}
                    {archiveData.data.rankings.length > 30 && (
                      <p className="text-[7px] text-zinc-500 text-center pt-2">
                        + {archiveData.data.rankings.length - 30} autres classements
                      </p>
                    )}
                  </div>
                )}

                {activeView === 'as_eg' && (
                  <div className="space-y-2">
                    <h4 className="text-[8px] font-black uppercase text-zinc-500 mb-2">
                      Sessions AS-EG ({archiveData.data.as_eg_sessions.length})
                    </h4>
                    {archiveData.data.as_eg_sessions.slice(0, 30).map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg"
                      >
                        <div>
                          <p className="text-[8px] font-bold text-white">{session.player_name}</p>
                          <p className="text-[6px] text-zinc-500">{session.session_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-red-500">{session.score}/{session.max_score}</p>
                          <p className="text-[7px] text-zinc-500">{formatDuration(session.duration_seconds)}</p>
                        </div>
                      </div>
                    ))}
                    {archiveData.data.as_eg_sessions.length > 30 && (
                      <p className="text-[7px] text-zinc-500 text-center pt-2">
                        + {archiveData.data.as_eg_sessions.length - 30} autres sessions
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : null}

      {/* Modal de détails */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Détails
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Fermer"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-[10px] text-zinc-500 text-center">
                Cliquez sur un élément pour voir ses détails
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
