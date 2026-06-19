
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  ShieldCheck,
  Database,
  Mail,
  Bell,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Save,
  Server,
  Archive,
  Clock,
  HardDrive,
  Cloud,
  Wifi
} from "lucide-react";

interface ConfigSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  fields: ConfigField[];
}

interface ConfigField {
  id: string;
  label: string;
  type: "text" | "password" | "email" | "number" | "select" | "toggle" | "textarea";
  value: string | boolean | number;
  placeholder?: string;
  options?: { value: string; label: string }[];
  description?: string;
  required?: boolean;
}

interface SystemStatus {
  database: "healthy" | "degraded" | "down";
  storage: "healthy" | "degraded" | "down";
  email: "healthy" | "degraded" | "down";
  websocket: "healthy" | "degraded" | "down";
  github: "healthy" | "degraded" | "down";
  lastBackup: string;
  diskUsage: number;
}

// Configuration par défaut (sera remplacée par l'API réelle)
const DEFAULT_CONFIG: ConfigSection[] = [
  {
    id: "general",
    title: "Général",
    description: "Paramètres généraux de l'application",
    icon: Settings,
    fields: [
      { id: "site_name", label: "Nom du site", type: "text", value: "VAGONDYS", placeholder: "VAGONDYS", required: true },
      { id: "site_url", label: "URL du site", type: "text", value: "https://vagondys.com", placeholder: "https://vagondys.com", required: true },
      { id: "maintenance_mode", label: "Mode maintenance", type: "toggle", value: false, description: "Bloque l'accès au site public" },
      { id: "default_city", label: "Ville par défaut", type: "select", value: "NANTES", options: [
        { value: "NANTES", label: "Nantes" },
        { value: "LYON", label: "Lyon" },
        { value: "PARIS", label: "Paris" },
        { value: "MARSEILLE", label: "Marseille" },
        { value: "MADRID", label: "Madrid" }
      ] }
    ]
  },
  {
    id: "security",
    title: "Sécurité",
    description: "Paramètres de sécurité et authentification",
    icon: ShieldCheck,
    fields: [
      { id: "admin_password", label: "Mot de passe admin", type: "password", value: "********", placeholder: "Nouveau mot de passe", required: true },
      { id: "session_duration", label: "Durée de session (minutes)", type: "number", value: 480, placeholder: "480", required: true },
      { id: "max_login_attempts", label: "Tentatives max avant blocage", type: "number", value: 5, placeholder: "5", required: true },
      { id: "two_factor_auth", label: "Authentification à deux facteurs", type: "toggle", value: false, description: "Recommandé pour les comptes admin" }
    ]
  },
  {
    id: "email",
    title: "Email",
    description: "Configuration des emails",
    icon: Mail,
    fields: [
      { id: "smtp_host", label: "Serveur SMTP", type: "text", value: "smtp.gmail.com", placeholder: "smtp.gmail.com", required: true },
      { id: "smtp_port", label: "Port SMTP", type: "number", value: 587, placeholder: "587", required: true },
      { id: "smtp_user", label: "Utilisateur SMTP", type: "email", value: "admin@vagondys.com", placeholder: "admin@vagondys.com", required: true },
      { id: "smtp_password", label: "Mot de passe SMTP", type: "password", value: "********", placeholder: "Mot de passe", required: true },
      { id: "admin_email", label: "Email admin", type: "email", value: "admin@vagondys.com", placeholder: "admin@vagondys.com", required: true }
    ]
  },
  {
    id: "database",
    title: "Base de données",
    description: "Paramètres de la base de données",
    icon: Database,
    fields: [
      { id: "backup_enabled", label: "Sauvegarde automatique", type: "toggle", value: true, description: "Sauvegarde quotidienne à 2h" },
      { id: "backup_retention_days", label: "Rétention des sauvegardes (jours)", type: "number", value: 30, placeholder: "30", required: true },
      { id: "auto_archive_days", label: "Archivage automatique (jours)", type: "number", value: 365, placeholder: "365", description: "Données inactives après X jours" }
    ]
  },
  {
    id: "integrations",
    title: "Intégrations",
    description: "Services externes et API",
    icon: Cloud,
    fields: [
      { id: "github_token", label: "Token GitHub", type: "password", value: "********", placeholder: "ghp_xxx", required: true },
      { id: "turnstile_site_key", label: "Turnstile Site Key", type: "text", value: "0x4AAAAAACLOCmBfCuxh1prL", placeholder: "0x4xxxx", required: true },
      { id: "turnstile_secret", label: "Turnstile Secret", type: "password", value: "********", placeholder: "0x4xxxx", required: true },
      { id: "resend_api_key", label: "Resend API Key", type: "password", value: "********", placeholder: "re_xxx", required: true }
    ]
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Alertes et notifications",
    icon: Bell,
    fields: [
      { id: "email_alerts", label: "Alertes par email", type: "toggle", value: true, description: "Recevoir les alertes système" },
      { id: "new_user_notify", label: "Notification nouvelle inscription", type: "toggle", value: true },
      { id: "new_message_notify", label: "Notification nouveau message", type: "toggle", value: true },
      { id: "system_alert_email", label: "Email pour alertes système", type: "email", value: "admin@vagondys.com", placeholder: "admin@vagondys.com" }
    ]
  }
];

// Statut système par défaut
const DEFAULT_SYSTEM_STATUS: SystemStatus = {
  database: "healthy",
  storage: "healthy",
  email: "healthy",
  websocket: "healthy",
  github: "healthy",
  lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  diskUsage: 45
};

export default function AdminConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigSection[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(DEFAULT_SYSTEM_STATUS);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string>("general");

  // Charger la configuration
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulation API
      await new Promise(resolve => setTimeout(resolve, 500));
      setConfig(DEFAULT_CONFIG);
    } catch (err) {
      console.error("Erreur chargement configuration:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger le statut système
  const loadSystemStatus = useCallback(async () => {
    try {
      setSystemStatus(DEFAULT_SYSTEM_STATUS);
    } catch (err) {
      console.error("Erreur chargement statut système:", err);
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
      loadConfig();
      loadSystemStatus();
    };
    checkAuth();
  }, [router, loadConfig, loadSystemStatus]);

  // Mettre à jour un champ
  const updateField = (sectionId: string, fieldId: string, value: string | boolean | number) => {
    setConfig(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        fields: section.fields.map(field => {
          if (field.id !== fieldId) return field;
          return { ...field, value };
        })
      };
    }));
  };

  // Sauvegarder la configuration
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess("Configuration sauvegardée avec succès");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  // Tester la connexion
  const handleTestConnection = async (service: string) => {
    alert(`Test de connexion à ${service}...\nFonctionnalité à implémenter.`);
  };

  // Déclencher une sauvegarde manuelle
  const handleManualBackup = async () => {
    alert("Sauvegarde manuelle déclenchée...\nFonctionnalité à implémenter.");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-500 bg-green-500/10 border-green-500/30";
      case "degraded": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
      case "down": return "text-red-500 bg-red-500/10 border-red-500/30";
      default: return "text-zinc-500 bg-zinc-500/10 border-zinc-500/30";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "healthy": return "Opérationnel";
      case "degraded": return "Dégradé";
      case "down": return "Hors ligne";
      default: return "Inconnu";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  const currentSectionConfig = config.find(s => s.id === activeSection);

  return (
    <div className="space-y-8">
      
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Configuration <span className="text-red-600">Système</span>
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Paramètres globaux de l&apos;application VAGONDYS
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          title="Enregistrer les modifications de configuration"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "SAUVEGARDE..." : "ENREGISTRER"}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-center gap-3 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 flex items-center gap-3 text-green-500">
          <CheckCircle className="w-5 h-5" />
          <p className="text-[10px] font-black uppercase tracking-widest">{success}</p>
        </div>
      )}

      {/* Statut système */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-red-600" />
          <h2 className="text-sm font-black uppercase tracking-tighter">
            Statut du <span className="text-red-600">système</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className={`p-3 rounded-xl border text-center ${getStatusColor(systemStatus.database)}`}>
            <Database className="w-4 h-4 mx-auto mb-1" />
            <p className="text-[7px] font-black uppercase">Base de données</p>
            <p className="text-[8px] font-bold">{getStatusLabel(systemStatus.database)}</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${getStatusColor(systemStatus.storage)}`}>
            <HardDrive className="w-4 h-4 mx-auto mb-1" />
            <p className="text-[7px] font-black uppercase">Stockage</p>
            <p className="text-[8px] font-bold">{systemStatus.diskUsage}% utilisé</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${getStatusColor(systemStatus.email)}`}>
            <Mail className="w-4 h-4 mx-auto mb-1" />
            <p className="text-[7px] font-black uppercase">Email</p>
            <p className="text-[8px] font-bold">{getStatusLabel(systemStatus.email)}</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${getStatusColor(systemStatus.websocket)}`}>
            <Wifi className="w-4 h-4 mx-auto mb-1" />
            <p className="text-[7px] font-black uppercase">WebSocket</p>
            <p className="text-[8px] font-bold">{getStatusLabel(systemStatus.websocket)}</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${getStatusColor(systemStatus.github)}`}>
            <Archive className="w-4 h-4 mx-auto mb-1" />
            <p className="text-[7px] font-black uppercase">GitHub</p>
            <p className="text-[8px] font-bold">{getStatusLabel(systemStatus.github)}</p>
          </div>
          <div className="p-3 rounded-xl border border-zinc-800 text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-zinc-500" />
            <p className="text-[7px] font-black uppercase">Dernière sauvegarde</p>
            <p className="text-[7px] text-zinc-400">{new Date(systemStatus.lastBackup).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleManualBackup}
            title="Lancer une sauvegarde manuelle du système"
            className="text-[8px] font-black uppercase text-zinc-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <Database className="w-3 h-3" />
            Sauvegarde manuelle
          </button>
        </div>
      </div>

      {/* Configuration - Layout à deux colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Menu latéral des sections */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden sticky top-8">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Sections
              </h3>
            </div>
            <nav className="p-2 space-y-1">
              {config.map((section) => {
                const SectionIcon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    title={`Afficher la section ${section.title}`}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeSection === section.id
                        ? "bg-red-600/10 border border-red-600/20 text-red-500"
                        : "text-zinc-500 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <SectionIcon className="w-4 h-4 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {section.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Formulaire de la section active */}
        <div className="lg:col-span-3">
          {currentSectionConfig && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <currentSectionConfig.icon className="w-5 h-5 text-red-600" />
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tighter text-white">
                      {currentSectionConfig.title}
                    </h2>
                    <p className="text-[8px] text-zinc-500 mt-0.5">
                      {currentSectionConfig.description}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {currentSectionConfig.fields.map((field) => {
                  const showPassword = showPasswords[field.id] || false;
                  
                  return (
                    <div key={field.id} className="space-y-2">
                      <label 
                        htmlFor={field.id}
                        className="text-[9px] font-black uppercase tracking-widest text-zinc-500"
                      >
                        {field.label}
                        {field.required && <span className="text-red-600 ml-1">*</span>}
                      </label>
                      
                      {field.type === "toggle" ? (
                        <div className="flex items-center justify-between p-3 bg-black/50 border border-zinc-800 rounded-xl">
                          <span className="text-[10px] text-zinc-400">
                            {field.value ? "Activé" : "Désactivé"}
                          </span>
                          <button
                            id={field.id}
                            type="button"
                            title={field.value ? "Désactiver l'option" : "Activer l'option"}
                            aria-label={field.value ? "Désactiver l'option" : "Activer l'option"}
                            onClick={() => updateField(currentSectionConfig.id, field.id, !field.value)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              field.value ? "bg-red-600" : "bg-zinc-700"
                            }`}
                          >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              field.value ? "right-1" : "left-1"
                            }`} />
                          </button>
                        </div>
                      ) : field.type === "select" ? (
                        <select
                          id={field.id}
                          title={field.label}
                          value={field.value as string}
                          onChange={(e) => updateField(currentSectionConfig.id, field.id, e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none transition-colors"
                        >
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          id={field.id}
                          title={field.label}
                          value={field.value as string}
                          onChange={(e) => updateField(currentSectionConfig.id, field.id, e.target.value)}
                          placeholder={field.placeholder}
                          rows={4}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none transition-colors resize-none"
                        />
                      ) : field.type === "password" ? (
                        <div className="relative">
                          <input
                            id={field.id}
                            title={field.label}
                            type={showPassword ? "text" : "password"}
                            value={field.value as string}
                            onChange={(e) => updateField(currentSectionConfig.id, field.id, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none transition-colors pr-12"
                          />
                          <button
                            type="button"
                            title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                            onClick={() => setShowPasswords(prev => ({ ...prev, [field.id]: !prev[field.id] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      ) : (
                        <input
                          id={field.id}
                          title={field.label}
                          type={field.type}
                          value={field.value as string}
                          onChange={(e) => updateField(currentSectionConfig.id, field.id, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-600 outline-none transition-colors"
                        />
                      )}
                      
                      {field.description && (
                        <p className="text-[7px] text-zinc-600 uppercase tracking-wider">
                          {field.description}
                        </p>
                      )}
                    </div>
                  );
                })}
                
                {/* Bouton de test pour sections spécifiques */}
                {currentSectionConfig.id === "email" && (
                  <div className="pt-4">
                    <button
                      onClick={() => handleTestConnection("SMTP")}
                      title="Tester la configuration de la connexion SMTP"
                      className="text-[8px] font-black uppercase text-zinc-500 hover:text-red-600 transition-colors"
                    >
                      Tester la connexion SMTP
                    </button>
                  </div>
                )}
                {currentSectionConfig.id === "integrations" && (
                  <div className="pt-4 flex gap-4">
                    <button
                      onClick={() => handleTestConnection("GitHub")}
                      title="Tester la connexion à l'API GitHub"
                      className="text-[8px] font-black uppercase text-zinc-500 hover:text-red-600 transition-colors"
                    >
                      Tester GitHub
                    </button>
                    <button
                      onClick={() => handleTestConnection("Turnstile")}
                      title="Tester la connexion à l'API Cloudflare Turnstile"
                      className="text-[8px] font-black uppercase text-zinc-500 hover:text-red-600 transition-colors"
                    >
                      Tester Turnstile
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Note de sécurité */}
      <div className="bg-red-600/5 border border-red-600/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-black uppercase text-red-600 tracking-widest">
              Sécurité critique
            </p>
            <p className="text-[8px] text-zinc-500 mt-1 leading-relaxed">
              Toute modification de la configuration est enregistrée dans les logs système. 
              Les mots de passe sont stockés de manière chiffrée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
