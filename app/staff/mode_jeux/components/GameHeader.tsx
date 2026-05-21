// app/staff/mode_jeux/components/GameHeader.tsx
"use client";

import Link from "next/link";
import { ChevronLeft, Wifi, WifiOff, Zap, MapPin } from "lucide-react";
import type { WebSocketStatus } from "@/lib/websocket/client";

interface GameHeaderProps {
  status: WebSocketStatus;
  serverIp: string;
  agentCity: string | null;
  agentEmail: string | null;
  onIpChange: (ip: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
}

export default function GameHeader({
  status,
  serverIp,
  agentCity,
  agentEmail,
  onIpChange,
  onConnect,
  onDisconnect,
  isConnecting
}: GameHeaderProps) {
  const isConnected = status === 'connected';

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link href="/staff" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] italic text-white">
            Unité <span className="text-red-600">Modes de Jeu</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Agent : {agentEmail || "Identification..."}
          </p>
          {agentCity && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <MapPin className="w-3 h-3 text-red-600" />
              <span className="text-[8px] font-black uppercase text-zinc-400">{agentCity}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Statut de connexion */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          isConnected 
            ? 'bg-green-600/10 border-green-600/30 text-green-500' 
            : status === 'connecting'
              ? 'bg-yellow-600/10 border-yellow-600/30 text-yellow-500'
              : 'bg-red-600/10 border-red-600/30 text-red-500'
        }`}>
          {isConnected ? (
            <><Wifi className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Connecté</span></>
          ) : status === 'connecting' ? (
            <><Zap className="w-4 h-4 animate-pulse" /> <span className="text-[10px] font-black uppercase">Connexion...</span></>
          ) : (
            <><WifiOff className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Déconnecté</span></>
          )}
        </div>

        {/* Contrôle IP */}
        <div className="hidden lg:flex items-center bg-black border border-white/5 rounded-lg px-3 py-1 gap-2 focus-within:border-red-600/50 transition-all">
          <input 
            type="text" 
            placeholder="IP DU SERVEUR..." 
            value={serverIp}
            onChange={(e) => onIpChange(e.target.value)}
            className="bg-transparent text-[9px] font-black uppercase tracking-widest outline-none text-white w-40 placeholder:text-zinc-800"
          />
          <button 
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isConnecting || !serverIp}
            className={`text-[9px] font-black transition-colors ${
              isConnected 
                ? 'text-red-600 hover:text-white' 
                : 'text-green-600 hover:text-white'
            }`}
          >
            {isConnecting ? '...' : isConnected ? 'DÉCO' : 'CONNEXION'}
          </button>
        </div>
      </div>
    </header>
  );
}
