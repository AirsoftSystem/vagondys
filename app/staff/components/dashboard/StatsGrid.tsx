// app/staff/components/dashboard/StatsGrid.tsx
"use client";

import { 
  Users, 
  MessageSquare, 
  Trophy, 
  Calendar, 
  Target, 
  Activity 
} from "lucide-react";
import { DashboardStats } from "../../types/dashboard";
import Card from "../ui/Card";

interface StatsGridProps {
  stats: DashboardStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  
  const statItems = [
    {
      label: "Licenciés",
      value: stats.totalAthletes,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    {
      label: "Actifs",
      value: stats.activeAthletes,
      icon: Activity,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    },
    {
      label: "Messages",
      value: stats.pendingMessages,
      icon: MessageSquare,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20"
    },
    {
      label: "Matchs aujourd'hui",
      value: stats.todayMatches,
      icon: Trophy,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    {
      label: "Lancements",
      value: stats.totalGameLaunches,
      icon: Target,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      label: "Nouveaux (mois)",
      value: stats.newAthletesThisMonth,
      icon: Calendar,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statItems.map((item, index) => (
        <Card key={index} padded={false} className="p-4 hover:border-white/10 transition-all">
          <div className="flex flex-col items-center text-center gap-2">
            <div className={`p-2 rounded-xl ${item.bg} ${item.border} border`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                {item.label}
              </p>
              <p className="text-lg font-black text-white">
                {item.value.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
