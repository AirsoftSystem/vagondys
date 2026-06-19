
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Activity,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  Users,
  Mail,
  Settings,
  MessageSquare,
  Calendar,
  Filter,
  Download,
  Clock
} from "lucide-react";

interface SystemLog {
  id: string;
  action: string;
  category: "auth" | "user" | "staff" | "messagerie" | "system" | "security";
  description: string;
  admin_email: string;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface GlobalLogsStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  categoriesCount: Record<string, number>;
}

// Données de démonstration (seront remplacées par l'API réelle)
const DEMO_LOGS: SystemLog[] = [
  {
    id: "1",
    action: "admin_login",
    category: "auth",
    description: "Connexion admin réussie",
    admin_email: "admin@vagondys.com",
    ip_address: "192.168.1.100",
    user_agent: "Chrome/120.0.0.0",
    metadata: { browser: "Chrome", os: "Windows" },
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: "2",
    action: "staff_invite",
    category: "staff",
    description: "Invitation envoyée à nantes@vagondys.com",
    admin_email: "admin@vagondys.com",
    ip_address: "192.168.1.100",
    user_agent: "Chrome/120.0.0.0",
    metadata: { role: "agent", city: "NANTES" },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "3",
    action: "messagerie_approve",
    category: "messagerie",
    description: "Demande messagerie approuvée - Jean Dupont",
    admin_email: "admin@vagondys.com",
    ip_address: "192.168.1.100",
    user_agent: "Chrome/120.0.0.0",
    metadata: { request_id: "1", user_email: "jean.dupont@fournisseur.com" },
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "4",
    action: "staff_suspend",
    category: "staff",
    description: "Agent suspendu - paris@vagondys.com",
    admin_email: "admin@vagondys.com",
    ip_address: "192.168.1.100",
    user_agent: "Chrome/120.0.0.0",
    metadata: { reason: "Inactivité prolongée" },
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "5",
    action: "system_backup",
    category: "system",
    description: "Sauvegarde automatique des données",
    admin_email: "system@vagondys.com",
    ip_address: "127.0.0.1",
    user_agent: "System",
    metadata: { size: "245MB", tables: ["athletes", "pending_signals"] },
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "6",
    action: "security_alert",
    category: "security",
    description: "Tentative de connexion échouée x3 - IP 45.67.89.10",
    admin_email: "system@vagondys.com",
    ip_address: "45.67.89.10",
    user_agent: "Unknown",
    metadata: { attempts: 3, blocked: true },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "7",
    action: "config_update",
    category: "system",
    description: "Configuration admin modifiée",
    admin_email: "admin@vagondys.com",
    ip_address: "192.168.1.100",
    user_agent: "Chrome/120.0.0.0",
    metadata: { key: "admin_password", changed: true },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "8",
    action: "user_delete",
    category: "user",
    description: "Compte utilisateur supprimé - ancien_joueur@email.com",
    admin_email: "admin@vagondys.com",
    ip_address: "192.168.1.100",
    user_agent: "Chrome/120.0.0.0",
    metadata: { user_id: "xxx", reason: "Demande utilisateur" },
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  auth: { label: "Authentification", color: "text-blue-500", icon: ShieldCheck },
  user: { label: "Utilisateurs", color: "text-green-500", icon: UserCheck },
  staff: { label: "Staff", color: "text-purple-500", icon: Users },
  messagerie: { label: "Messagerie", color: "text-yellow-500", icon: MessageSquare },
  system: { label: "Système", color: "text-orange-500", icon: Settings },
  security: { label: "Sécurité", color: "text-red-500", icon: AlertTriangle }
};

const ACTION_LABELS: Record<string, string> = {
  admin_login: "Connexion admin",
  staff_invite: "Invitation staff",
  staff_suspend: "Suspension staff",
  staff_activate: "Activation staff",
  staff_delete: "Suppression staff",
  messagerie_approve: "Approbation messagerie",
  messagerie_reject: "Rejet messagerie",
  user_create: "Création utilisateur",
  user_delete: "Suppression utilisateur",
  user_update: "Mise à jour utilisateur",
  system_backup: "Sauvegarde système",
  config_update: "Modification configuration",
  security_alert: "Alerte sécurité"
};

export default function AdminLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalLogsStats>({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    categoriesCount: {}
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Charger les logs
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Remplacer par l'API réelle
      // const response = await fetch("/api/admin/logs");
      // const data = await response.json();
      
      // Simulation API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setLogs(DEMO_LOGS);
      
      // Calculer les stats globales
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const categoriesCount: Record<string, number> = {};
      DEMO_LOGS.forEach(log => {
        categoriesCount[log.category] = (categoriesCount[log.category] || 0) + 1;
      });
      
      setGlobalStats({
        total: DEMO_LOGS.length,
        today: DEMO_LOGS.filter(l => new Date(l.created_at) >= today).length,
        thisWeek: DEMO_LOGS.filter(l => new Date(l.created_at) >= weekAgo).length,
        thisMonth: DEMO_LOGS.filter(l => new Date(l.created_at) >= monthAgo).length,
        categoriesCount
      });
      
    } catch (err) {
      console.error("Erreur chargement logs:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier l'authentification admin
  useEffect(() => {
    const checkAuth = () => {
      const isAuthenticated = sessionStorage.getItem("admin_authenticated") === "true";
      if (!isAuthenticated) {
        router.push("/admin/verification");
        return;
      }
      loadLogs();
    };
    checkAuth();
  }, [router, loadLogs]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionLabel = (action: string): string => {
    return ACTION_LABELS[action] || action.replace(/_/g, ' ').toUpperCase();
  };

  const filteredLogs = logs.filter(log => {
    // Filtre recherche
    if (searchTerm && !log.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !log.admin_email.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !log.ip_address.includes(searchTerm)) {
      return false;
    }
    // Filtre catégorie
    if (filterCategory !== "all" && log.category !== filterCategory) {
      return false;
    }
    // Filtre action
    if (filterAction !== "all" && log.action !== filterAction) {
      return false;
    }
    // Filtre date
    if (dateRange !== "all") {
      const logDate = new Date(log.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      if (dateRange === "today" && logDate < today) return false;
      if (dateRange === "week" && logDate < weekAgo) return false;
      if (dateRange === "month" && logDate < monthAgo) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_vagondys_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  // Obtenir les actions uniques pour le filtre
  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="space-y-8">
      
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Logs <span className="text-red-600">Système</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Journal des actions administratives et événements système
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            title="Exporter les logs"
            aria-label="Exporter les logs"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            title="Actualiser"
            aria-label="Actualiser"
          >
            <RefreshCcw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      {/* Cartes statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Total</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.total}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Aujourd&apos;hui</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.today}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <Calendar className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">7 jours</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.thisWeek}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">30 jours</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.thisMonth}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Rechercher dans les logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-colors"
            title="Rechercher dans les logs"
            aria-label="Rechercher dans les logs"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par catégorie"
          aria-label="Filtrer par catégorie"
        >
          <option value="all">Toutes les catégories</option>
          {Object.keys(CATEGORY_LABELS).map(cat => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat].label}</option>
          ))}
        </select>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par action"
          aria-label="Filtrer par action"
        >
          <option value="all">Toutes les actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{getActionLabel(action)}</option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as "all" | "today" | "week" | "month")}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par période"
          aria-label="Filtrer par période"
        >
          <option value="all">Toutes les périodes</option>
          <option value="today">Aujourd&apos;hui</option>
          <option value="week">7 derniers jours</option>
          <option value="month">30 derniers jours</option>
        </select>
        <button
          onClick={() => {
            setSearchTerm("");
            setFilterCategory("all");
            setFilterAction("all");
            setDateRange("all");
            setCurrentPage(1);
          }}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          title="Réinitialiser les filtres"
          aria-label="Réinitialiser les filtres"
        >
          <Filter className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Tableau des logs */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Journal des <span className="text-red-600">événements</span>
          </h2>
          <span className="text-[8px] text-zinc-500">
            {filteredLogs.length} entrées
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Date/Heure</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Catégorie</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Action</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Description</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Admin</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">IP</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => {
                const categoryConfig = CATEGORY_LABELS[log.category] || CATEGORY_LABELS.system;
                const CategoryIcon = categoryConfig.icon;
                
                return (
                  <React.Fragment key={log.id}>
                    <tr className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                      <td className="p-4">
                        <span className="text-[10px] text-zinc-500 font-mono">{formatDate(log.created_at)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className={`w-3 h-3 ${categoryConfig.color}`} />
                          <span className={`text-[8px] font-black uppercase ${categoryConfig.color}`}>
                            {categoryConfig.label}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono text-white">{getActionLabel(log.action)}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] text-zinc-400">{log.description}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          <span className="text-[10px] text-zinc-400">{log.admin_email}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-mono text-zinc-500">{log.ip_address}</span>
                      </td>
                      <td className="p-4">
                        {expandedLog === log.id ? (
                          <ChevronUp className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        )}
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="bg-black/50">
                        <td colSpan={7} className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Métadonnées</h4>
                              <pre className="text-[9px] text-zinc-400 bg-black/50 p-3 rounded-xl overflow-x-auto font-mono">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Informations techniques</h4>
                              <p className="text-[9px] text-zinc-400">
                                <strong className="text-white">User Agent:</strong><br />
                                {log.user_agent}
                              </p>
                              <p className="text-[9px] text-zinc-400 mt-2">
                                <strong className="text-white">ID Log:</strong> {log.id}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Précédent
          </button>
          <span className="text-[10px] text-zinc-500">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Note de rétention */}
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-3 text-center">
        <p className="text-[7px] text-zinc-600 uppercase tracking-widest">
          Conservation des logs : 90 jours • Les logs plus anciens sont automatiquement archivés
        </p>
      </div>
    </div>
  );
}
