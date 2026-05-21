// app/staff/components/dashboard/TopPlayers.tsx
"use client";

import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { TopPlayer } from "../../types/dashboard";
import Card from "../ui/Card";

interface TopPlayersProps {
  players: TopPlayer[];
  loading: boolean;
}

export default function TopPlayers({ players, loading }: TopPlayersProps) {
  
  const getRankIcon = (index: number) => {
    switch(index) {
      case 0: return <Trophy className="w-3 h-3 text-yellow-500" />;
      case 1: return <Medal className="w-3 h-3 text-zinc-400" />;
      case 2: return <Award className="w-3 h-3 text-amber-600" />;
      default: return <TrendingUp className="w-3 h-3 text-red-600" />;
    }
  };

  const getRankColor = (index: number) => {
    switch(index) {
      case 0: return 'text-yellow-500';
      case 1: return 'text-zinc-400';
      case 2: return 'text-amber-600';
      default: return 'text-red-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <p className="text-[10px] text-zinc-600 animate-pulse">Chargement du classement...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
          Top Joueurs
        </h3>
        <span className="text-[8px] text-zinc-600">Classement général</span>
      </div>

      <div className="space-y-2">
        {players.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/5 rounded-xl">
            <p className="text-[9px] text-zinc-700 uppercase tracking-widest">
              Aucun joueur classé
            </p>
          </div>
        ) : (
          players.slice(0, 5).map((player, index) => (
            <div 
              key={player.id}
              className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5 hover:border-red-600/20 transition-all group"
            >
              <div className={`w-6 h-6 rounded-lg bg-black border border-white/5 flex items-center justify-center text-[9px] font-black ${getRankColor(index)}`}>
                #{index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white truncate">
                    {player.pseudo || player.full_name}
                  </p>
                  {getRankIcon(index)}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[8px] font-mono text-zinc-600">
                    {player.points} pts
                  </span>
                  <span className="text-[8px] font-mono text-zinc-700">
                    {player.matchesPlayed} matchs
                  </span>
                  <span className="text-[8px] font-mono text-green-600">
                    {player.winRate}% wins
                  </span>
                </div>
              </div>
              <div className="px-2 py-1 bg-black/50 rounded-lg border border-white/5">
                <span className="text-[7px] font-black uppercase text-zinc-600">
                  {player.rank}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
