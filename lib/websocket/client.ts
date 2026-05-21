
// lib/websocket/client.ts
export type WebSocketStatus = 'connected' | 'disconnected' | 'connecting';

export type GameMode = 
  | 'CF1' | 'CF2' | 'CF3' | 'CF4'   // Classic Facile
  | 'CSP1' | 'CSP2' | 'CSP3' | 'CSP4' // Classic Semi-Pro
  | 'CP1' | 'CP2' | 'CP3' | 'CP4'   // Classic Pro
  | 'CC1' | 'CC2' | 'CC3' | 'CC4'   // Classic Champion
  | 'CL1' | 'CL2' | 'CL3' | 'CL4'   // Classic Légende
  | 'LJ1' | 'LJ2' | 'LJ3' | 'LJ4'   // Le Jeu
  | 'MS1' | 'MS2' | 'MS3' | 'MS4';  // Mode Survie

export interface WebSocketMessage {
  type: string;
  message?: string;
  [key: string]: unknown;
}

class WebSocketClient {
  private socket: WebSocket | null = null;
  private status: WebSocketStatus = 'disconnected';
  private messageHandlers: ((data: WebSocketMessage) => void)[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverUrl: string | null = null;

  getStatus(): WebSocketStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  onMessage(handler: (data: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  connect(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.status === 'connected' || !url) {
        resolve(this.status === 'connected');
        return;
      }

      this.status = 'connecting';
      this.serverUrl = url;
      this.notifyStatusChange();

      try {
        // En environnement navigateur, on utilise l'URL directement
        const wsUrl = url.startsWith('ws') ? url : `wss://${url}`;
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          console.log('✅ WebSocket connecté');
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.notifyStatusChange();
          resolve(true);
        };

        this.socket.onclose = () => {
          console.log('🔌 WebSocket déconnecté');
          this.status = 'disconnected';
          this.notifyStatusChange();
          this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
          console.error('❌ WebSocket erreur:', error);
          this.status = 'disconnected';
          this.notifyStatusChange();
          resolve(false);
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WebSocketMessage;
            this.messageHandlers.forEach(handler => handler(data));
          } catch (e) {
            console.error('Erreur parsing message:', e);
          }
        };

      } catch (error) {
        console.error('❌ Erreur connexion WebSocket:', error);
        this.status = 'disconnected';
        this.notifyStatusChange();
        resolve(false);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    this.notifyStatusChange();
  }

  send(message: WebSocketMessage | string) {
    if (this.socket && this.status === 'connected') {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.socket.send(data);
      console.log('📤 Commande envoyée:', data);
    } else {
      console.warn('⚠️ WebSocket non connecté, impossible d\'envoyer');
    }
  }

  sendCommand(type: string, message: string) {
    this.send({ type, message });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.serverUrl) {
      console.log('❌ Abandon de la reconnexion');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectAttempts * 2000;

    console.log(`♻️ Tentative de reconnexion #${this.reconnectAttempts} dans ${delay / 1000}s`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.serverUrl) {
        console.log('🔁 Reconnexion en cours...');
        this.connect(this.serverUrl);
      }
    }, delay);
  }

  private notifyStatusChange() {
    // On pourrait utiliser un système d'observers, mais pour l'instant,
    // on laisse le composant gérer via le hook.
  }
}

// Singleton
export const websocketClient = new WebSocketClient();
