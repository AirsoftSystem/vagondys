
"use client";

import Link from "next/link";
import { 
  Trophy,
  Settings,
  MessageSquare,
  Target,
  Bell,
  UserPlus,
  Users,
  CalendarCheck,
  Calendar,
  Star,
  Award,
  ShieldCheck  // 👈 AJOUTÉ pour ADMIN
} from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";

interface NavigationGridProps {
  menuItems: Array<{
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
  }>;
  city?: string | null;
  unreadCount?: number;
  newAthletesCount?: number;
}

export default function NavigationGrid({ 
  menuItems, 
  city,
  unreadCount = 0,
  newAthletesCount = 0
}: NavigationGridProps) {

  // Actions rapides (sans doublons)
  const quickActions = [
    {
      id: 'quick-message',
      title: "MESSAGERIE",
      description: "Transmission immédiate",
      href: "/staff/interface",
      icon: MessageSquare,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      badge: unreadCount
    },
    {
      id: 'quick-game',
      title: "LANCER UNE PARTIE",
      description: "Contrôle des cibles",
      href: "/staff/mode_jeux",
      icon: Target,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      id: 'quick-licencie',
      title: "LICENCIÉS",
      description: "Nouveau dossier",
      href: "/staff/licencies",
      icon: UserPlus,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      badge: newAthletesCount
    },
    // 👇 Tournois
    {
      id: 'quick-tournois',
      title: "TOURNOIS",
      description: "Compétitions à venir",
      href: "/staff/tournois",
      icon: Award,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    // 👇 Notoriété
    {
      id: 'quick-notoriete',
      title: "NOTORIÉTÉ",
      description: "Classement et réputation",
      href: "/staff/notoriete",
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20"
    },
    // 👇 ADMIN - Supervision globale
    {
      id: 'quick-admin',
      title: "ADMIN",
      description: "Supervision globale",
      href: "/staff/admin-verification",
      icon: ShieldCheck,
      color: "text-red-600",
      bg: "bg-red-600/10",
      border: "border-red-600/20"
    }
  ];

  // Menu items existants (sans les doublons avec quickActions)
  const menuWithStyle = menuItems
    .filter(item => 
      item.href !== "/staff/interface" && 
      item.href !== "/staff/mode_jeux" && 
      item.href !== "/staff/licencies"
    )
    .map((item, index) => ({
      ...item,
      id: `menu-${item.href.split('/').pop() || index}`,
      color: item.icon === Trophy ? "text-yellow-500" :
             item.icon === MessageSquare ? "text-blue-500" :
             item.icon === Users ? "text-green-500" :
             item.icon === CalendarCheck ? "text-purple-500" :
             item.icon === Calendar ? "text-purple-500" :
             item.icon === Settings ? "text-zinc-500" : "text-red-500",
      bg: item.icon === Trophy ? "bg-yellow-500/10" :
           item.icon === MessageSquare ? "bg-blue-500/10" :
           item.icon === Users ? "bg-green-500/10" :
           item.icon === CalendarCheck ? "bg-purple-500/10" :
           item.icon === Calendar ? "bg-purple-500/10" :
           item.icon === Settings ? "bg-zinc-500/10" : "bg-red-500/10",
      border: item.icon === Trophy ? "border-yellow-500/20" :
              item.icon === MessageSquare ? "border-blue-500/20" :
              item.icon === Users ? "border-green-500/20" :
              item.icon === CalendarCheck ? "border-purple-500/20" :
              item.icon === Calendar ? "border-purple-500/20" :
              item.icon === Settings ? "border-zinc-500/20" : "border-red-500/20"
    }));

  // Fusion sans doublons
  const allItems = [...quickActions, ...menuWithStyle];

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
          Navigation {city ? `- Station ${city}` : ''}
        </h3>
        <Badge variant="info" size="sm">
          {allItems.length} modules
        </Badge>
      </div>

      {/* GRILLE UNIQUE - Sans doublons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {allItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group relative flex flex-col p-5 bg-black/30 rounded-xl border border-white/5 hover:border-red-600/30 transition-all hover:bg-black/50"
          >
            {/* En-tête avec icône et badge */}
            <div className="flex items-start justify-between mb-3">
              <div className={`p-3 rounded-xl border ${item.bg} ${item.border} group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              {item.badge && item.badge > 0 && (
                <div className="relative">
                  <span className="flex items-center gap-1 text-red-500 text-[8px] font-black">
                    <Bell className="w-3 h-3" /> {item.badge}
                  </span>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-ping" />
                </div>
              )}
            </div>

            {/* Contenu */}
            <div className="flex-1">
              <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">
                {item.title}
              </h4>
              <p className="text-[8px] uppercase tracking-wider text-neutral-500 line-clamp-2">
                {item.description}
              </p>
            </div>

            {/* Effet de survol */}
            <div className="absolute inset-0 rounded-xl bg-linear-to-r from-red-600/0 to-red-600/0 group-hover:from-red-600/5 group-hover:to-transparent transition-all pointer-events-none" />
          </Link>
        ))}
      </div>

      {/* Légende */}
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[7px] text-zinc-700 uppercase tracking-widest">
        <span>Interface unifiée • {allItems.length} modules</span>
        <span>Station {city || 'principale'}</span>
      </div>
    </Card>
  );
}
