// app/staff/components/dashboard/CityInfoCard.tsx
"use client";

import { Users, Shield } from "lucide-react"; // ✅ Suppression de MapPin et Globe non utilisés
import { CityInfo } from "../../types/dashboard";
import Card from "../ui/Card";
import Badge from "../ui/Badge";

interface CityInfoCardProps {
  cityInfo: CityInfo | null;
  userEmail: string | null;
  userCity: string | null;
}

export default function CityInfoCard({ cityInfo, userEmail, userCity }: CityInfoCardProps) {
  
  if (!cityInfo || !userCity) {
    return (
      <Card className="flex items-center gap-4">
        <div className="p-3 bg-red-600/10 rounded-xl">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
            Station non identifiée
          </p>
          <p className="text-xs font-mono text-zinc-400 mt-1">{userEmail}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-900/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              Station {cityInfo.name}
            </h2>
            <Badge variant="info" size="sm">
              {cityInfo.country}
            </Badge>
          </div>
          <p className="text-[9px] font-mono text-zinc-500">
            {userEmail}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-black/50 rounded-xl border border-white/5">
          <Users className="w-3 h-3 text-red-600" />
          <div>
            <p className="text-[8px] font-black uppercase text-zinc-600">Total</p>
            <p className="text-xs font-black text-white">{cityInfo.totalAthletes}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-black/50 rounded-xl border border-white/5">
          <Shield className="w-3 h-3 text-green-600" />
          <div>
            <p className="text-[8px] font-black uppercase text-zinc-600">Actifs</p>
            <p className="text-xs font-black text-white">{cityInfo.activeAthletes}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
