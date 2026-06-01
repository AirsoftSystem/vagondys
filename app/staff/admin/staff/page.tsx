
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  UserCog,
  ShieldCheck,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Mail,
  Calendar,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  XCircle
} from "lucide-react";

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  city: string;
  country: string;
  role: "admin" | "superadmin" | "agent";
  status: "active" | "inactive" | "suspended";
  last_login: string;
  created_at: string;
  created_by: string;
}

interface GlobalStaffStats {
  totalStaff: number;
  totalAdmins: number;
  totalSuperAdmins: number;
  totalAgents: number;
  activeStaff: number;
  inactiveStaff: number;
}

// Données de démonstration (seront remplacées par l'API réelle)
const DEMO_STAFF: StaffMember[] = [
  {
    id: "1",
    email: "admin@vagondys.com",
    full_name: "Administrateur Principal",
    city: "MASTER",
    country: "FR",
    role: "superadmin",
    status: "active",
    last_login: new Date().toISOString(),
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: "system"
  },
  {
    id: "2",
    email: "nantes@vagondys.com",
    full_name: "Agent Nantes",
    city: "NANTES",
    country: "FR",
    role: "agent",
    status: "active",
    last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: "admin@vagondys.com"
  },
  {
    id: "3",
    email: "lyon@vagondys.com",
    full_name: "Agent Lyon",
    city: "LYON",
    country: "FR",
    role: "agent",
    status: "active",
    last_login: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: "admin@vagondys.com"
  },
  {
    id: "4",
    email: "madrid@vagondys.com",
    full_name: "Agent Madrid",
    city: "MADRID",
    country: "ES",
    role: "agent",
    status: "active",
    last_login: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: "admin@vagondys.com"
  },
  {
    id: "5",
    email: "paris@vagondys.com",
    full_name: "Agent Paris",
    city: "PARIS",
    country: "FR",
    role: "agent",
    status: "inactive",
    last_login: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: "admin@vagondys.com"
  }
];

export default function AdminStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStaffStats>({
    totalStaff: 0,
    totalAdmins: 0,
    totalSuperAdmins: 0,
    totalAgents: 0,
    activeStaff: 0,
    inactiveStaff: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");
  const [inviteCity, setInviteCity] = useState("NANTES");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Charger les données
  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Remplacer par l'API réelle
      // const response = await fetch("/api/admin/staff");
      // const data = await response.json();
      
      // Simulation API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStaffMembers(DEMO_STAFF);
      
      // Calculer les stats globales
      const stats: GlobalStaffStats = {
        totalStaff: DEMO_STAFF.length,
        totalAdmins: DEMO_STAFF.filter(s => s.role === "admin").length,
        totalSuperAdmins: DEMO_STAFF.filter(s => s.role === "superadmin").length,
        totalAgents: DEMO_STAFF.filter(s => s.role === "agent").length,
        activeStaff: DEMO_STAFF.filter(s => s.status === "active").length,
        inactiveStaff: DEMO_STAFF.filter(s => s.status !== "active").length
      };
      setGlobalStats(stats);
      
    } catch (err) {
      console.error("Erreur chargement staff:", err);
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
        router.push("/staff/admin/verification");
        return;
      }
      loadStaff();
    };
    checkAuth();
  }, [router, loadStaff]);

  const formatDate = (dateStr: string): string => {
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
    return date.toLocaleDateString('fr-FR');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return <span className="text-[8px] text-red-600 bg-red-600/10 px-2 py-0.5 rounded-full border border-red-600/30">SUPER ADMIN</span>;
      case "admin":
        return <span className="text-[8px] text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">ADMIN</span>;
      case "agent":
        return <span className="text-[8px] text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">AGENT</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="text-[8px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">ACTIF</span>;
      case "inactive":
        return <span className="text-[8px] text-zinc-500 bg-zinc-500/10 px-2 py-0.5 rounded-full">INACTIF</span>;
      case "suspended":
        return <span className="text-[8px] text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">SUSPENDU</span>;
      default:
        return null;
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    setIsSendingInvite(true);
    try {
      // TODO: Appeler l'API d'invitation
      // const response = await fetch("/api/admin/staff/invite", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email: inviteEmail, role: inviteRole, city: inviteCity })
      // });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert(`Invitation envoyée à ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail("");
      loadStaff();
    } catch (err) {
      console.error("Erreur invitation:", err);
      alert("Erreur lors de l'envoi de l'invitation");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const filteredStaff = staffMembers.filter(member => {
    if (searchTerm && !member.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !member.full_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterRole !== "all" && member.role !== filterRole) {
      return false;
    }
    if (filterStatus !== "all" && member.status !== filterStatus) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Gestion du <span className="text-red-600">Staff</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Supervision des agents et administrateurs du réseau VAGONDYS
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Inviter un agent
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      {/* Cartes statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Total</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalStaff}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-600/10 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Super Admins</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalSuperAdmins}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <UserCog className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Admins</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalAdmins}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Agents</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.totalAgents}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Actifs</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.activeStaff}</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Inactifs</span>
          </div>
          <p className="text-2xl font-black text-white">{globalStats.inactiveStaff}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Rechercher un agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none transition-colors"
            title="Rechercher un agent"
            aria-label="Rechercher un agent"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par rôle"
          aria-label="Filtrer par rôle"
        >
          <option value="all">Tous les rôles</option>
          <option value="superadmin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white focus:border-red-600 outline-none cursor-pointer"
          title="Filtrer par statut"
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="suspended">Suspendus</option>
        </select>
        <button
          onClick={loadStaff}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          title="Actualiser"
          aria-label="Actualiser"
        >
          <RefreshCcw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Tableau des agents */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Liste des <span className="text-red-600">agents</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/30">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Agent</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Email</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Ville</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Rôle</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Statut</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">Dernière connexion</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-zinc-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member) => (
                <React.Fragment key={member.id}>
                  <tr className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <span className="text-xs font-black text-white">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-black text-white">{member.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-400">{member.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black text-white">{member.city}</span>
                    </td>
                    <td className="p-4">
                      {getRoleBadge(member.role)}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(member.status)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        <span className="text-[10px] text-zinc-500">{formatDate(member.last_login)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {expandedMember === member.id ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </td>
                  </tr>
                  {expandedMember === member.id && (
                    <tr className="bg-black/50">
                      <td colSpan={7} className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Informations</h4>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">ID:</strong> {member.id}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">Créé le:</strong> {new Date(member.created_at).toLocaleDateString('fr-FR')}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              <strong className="text-white">Créé par:</strong> {member.created_by}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Actions</h4>
                            <div className="flex gap-3 flex-wrap">
                              {member.role !== "superadmin" && (
                                <>
                                  <button className="text-[8px] font-black uppercase bg-zinc-800 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                    <Edit className="w-3 h-3" />
                                    Modifier
                                  </button>
                                  <button className="text-[8px] font-black uppercase bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                    <Trash2 className="w-3 h-3" />
                                    Supprimer
                                  </button>
                                  {member.status === "active" ? (
                                    <button className="text-[8px] font-black uppercase bg-zinc-800 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                      <Ban className="w-3 h-3" />
                                      Suspendre
                                    </button>
                                  ) : (
                                    <button className="text-[8px] font-black uppercase bg-zinc-800 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Réactiver
                                    </button>
                                  )}
                                </>
                              )}
                              {member.role === "superadmin" && (
                                <p className="text-[8px] text-zinc-600 italic">Actions restreintes pour super admin</p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Permissions</h4>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[7px] px-2 py-1 bg-zinc-800 rounded-full text-zinc-400">Accès staff</span>
                              <span className="text-[7px] px-2 py-1 bg-zinc-800 rounded-full text-zinc-400">Gestion messages</span>
                              {member.role !== "agent" && (
                                <span className="text-[7px] px-2 py-1 bg-red-600/20 text-red-500 rounded-full">Accès admin</span>
                              )}
                              {member.role === "superadmin" && (
                                <span className="text-[7px] px-2 py-1 bg-red-600/20 text-red-500 rounded-full">Supervision globale</span>
                              )}
                            </div>
                          </div>
                        </div>
                       </td>
                     </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
           </table>
        </div>
      </div>

      {/* Modal d'invitation */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setShowInviteModal(false)} />
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-tighter text-white">
                Inviter un <span className="text-red-600">agent</span>
              </h2>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                ✕
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  Email de l&apos;agent
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="agent@vagondys.com"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none"
                  required
                  title="Email de l'agent"
                  aria-label="Email de l'agent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  Rôle
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "agent")}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none"
                  title="Rôle"
                  aria-label="Rôle"
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  Ville d&apos;affectation
                </label>
                <select
                  value={inviteCity}
                  onChange={(e) => setInviteCity(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none"
                  title="Ville"
                  aria-label="Ville"
                >
                  <option value="NANTES">Nantes</option>
                  <option value="LYON">Lyon</option>
                  <option value="PARIS">Paris</option>
                  <option value="MARSEILLE">Marseille</option>
                  <option value="BORDEAUX">Bordeaux</option>
                  <option value="LILLE">Lille</option>
                  <option value="TOULOUSE">Toulouse</option>
                  <option value="MADRID">Madrid</option>
                </select>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSendingInvite}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {isSendingInvite ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {isSendingInvite ? "ENVOI..." : "ENVOYER L'INVITATION"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
