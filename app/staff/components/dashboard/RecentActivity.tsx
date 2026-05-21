// app/staff/components/dashboard/RecentActivity.tsx
"use client";

import { 
  MessageSquare, 
  Target, 
  Trophy, 
  UserPlus, 
  Clock,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { RecentActivity } from "../../types/dashboard";
import Card from "../ui/Card";

interface RecentActivityProps {
  activities: RecentActivity[];
  loading: boolean;
}

export default function RecentActivityComponent({ activities, loading }: RecentActivityProps) {
  
  const getIcon = (type: string) => {
    switch(type) {
      case 'message': return <MessageSquare className="w-3 h-3" />;
      case 'game_launch': return <Target className="w-3 h-3" />;
      case 'match': return <Trophy className="w-3 h-3" />;
      case 'inscription': return <UserPlus className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getIconBg = (type: string) => {
    switch(type) {
      case 'message': return 'bg-blue-500/10 border-blue-500/20 text-blue-500';
      case 'game_launch': return 'bg-red-500/10 border-red-500/20 text-red-500';
      case 'match': return 'bg-purple-500/10 border-purple-500/20 text-purple-500';
      case 'inscription': return 'bg-green-500/10 border-green-500/20 text-green-500';
      default: return 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <p className="text-[10px] text-zinc-600 animate-pulse">Chargement des activités...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
          Activités récentes
        </h3>
        <span className="text-[8px] text-zinc-600">{activities.length} événements</span>
      </div>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/5 rounded-xl">
            <p className="text-[9px] text-zinc-700 uppercase tracking-widest">
              Aucune activité récente
            </p>
          </div>
        ) : (
          activities.slice(0, 5).map((activity) => (
            <div 
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-black/30 rounded-xl border border-white/5 hover:border-red-600/20 transition-all group"
            >
              <div className={`p-2 rounded-lg border ${getIconBg(activity.type)}`}>
                {getIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-white truncate">
                  {activity.title}
                </p>
                <p className="text-[8px] text-zinc-600 mt-0.5 line-clamp-1">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Clock className="w-2.5 h-2.5 text-zinc-700" />
                  <span className="text-[7px] font-mono text-zinc-700">
                    {formatDate(activity.timestamp)}
                  </span>
                </div>
              </div>
              {activity.link && (
                <Link 
                  href={activity.link}
                  className="p-1.5 rounded-lg bg-black/50 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
