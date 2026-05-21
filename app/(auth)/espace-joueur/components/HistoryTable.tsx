import React, { useState } from 'react';
import { MatchRecord } from '../types';
import { Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

interface HistoryTableProps {
  history: MatchRecord[];
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ history }) => {
  const [expanded, setExpanded] = useState(false);

  const displayHistory = expanded ? history : history.slice(0, 5);

  if (history.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <Archive className="w-5 h-5 text-zinc-700" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
            HISTORIQUE DES PARTIES
          </p>
        </div>
        <div className="flex items-center justify-center border border-dashed border-zinc-800 rounded-xl py-12">
          <p className="text-[9px] text-zinc-700 italic">
            Aucune partie enregistrée
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-red-600" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            HISTORIQUE DES PARTIES
          </p>
        </div>
        <p className="text-[8px] font-black uppercase text-zinc-700">
          {history.length} ENTRIES
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-zinc-900 text-[8px] font-black uppercase text-zinc-500">
              <th className="p-3">Date</th>
              <th className="p-3">Score</th>
              <th className="p-3">Durée</th>
              <th className="p-3">K/D/A</th>
              <th className="p-3">Timeout</th>
              <th className="p-3">0</th>
              <th className="p-3">5</th>
              <th className="p-3">10</th>
              <th className="p-3">15</th>
              <th className="p-3">25</th>
              <th className="p-3">50</th>
              <th className="p-3">100+</th>
            </tr>
          </thead>
          <tbody className="text-[9px] font-mono">
            {[...displayHistory].reverse().map((match, idx) => {
              // Calculer les tirs 100+ (100, 150, 200, 250)
              const highPoints = (match.shotDistribution['100'] || 0) +
                (match.shotDistribution['150'] || 0) +
                (match.shotDistribution['200'] || 0) +
                (match.shotDistribution['250'] || 0);
              
              return (
                <tr 
                  key={idx} 
                  className="border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors group"
                >
                  <td className="p-3 text-zinc-400 font-black text-[8px]">
                    {formatDateTime(match.date)}
                  </td>
                  <td className="p-3 text-white font-black">
                    {match.score}
                  </td>
                  <td className="p-3 text-zinc-400">
                    {match.duration.toFixed(1)}s
                  </td>
                  <td className="p-3">
                    <span className="text-green-500">{match.kills}</span>
                    <span className="text-zinc-700 mx-1">/</span>
                    <span className="text-red-500">{match.deaths}</span>
                    <span className="text-zinc-700 mx-1">/</span>
                    <span className="text-blue-500">{match.assists}</span>
                  </td>
                  <td className="p-3 text-zinc-600">
                    {match.shotDistribution['timeout'] || 0}
                  </td>
                  <td className="p-3 text-zinc-600">
                    {match.shotDistribution['0'] || 0}
                  </td>
                  <td className="p-3 text-orange-400">
                    {match.shotDistribution['5'] || 0}
                  </td>
                  <td className="p-3 text-yellow-400">
                    {match.shotDistribution['10'] || 0}
                  </td>
                  <td className="p-3 text-green-400">
                    {match.shotDistribution['15'] || 0}
                  </td>
                  <td className="p-3 text-blue-300">
                    {match.shotDistribution['25'] || 0}
                  </td>
                  <td className="p-3 text-blue-500">
                    {match.shotDistribution['50'] || 0}
                  </td>
                  <td className="p-3 text-purple-500">
                    {highPoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Bouton Voir plus / Voir moins */}
      {history.length > 5 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
            title={expanded ? "Voir moins de parties" : "Voir toutes les parties"}
            aria-label={expanded ? "Réduire" : "Développer"}
          >
            {expanded ? (
              <>
                <ChevronUp size={12} />
                VOIR MOINS
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                VOIR LES {history.length} PARTIES
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
