import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface GamificationWebSocketEvent {
  type: string;
  data: any;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class GamificationWebSocketService {
  private socket?: WebSocket;
  private eventsSubject = new Subject<GamificationWebSocketEvent>();
  public events$: Observable<GamificationWebSocketEvent> = this.eventsSubject.asObservable();

  private reconnectInterval = 5000;
  private reconnectTimer?: number;
  private isIntentionalDisconnect = false;

  constructor() {
    console.log('🔌 GamificationWebSocketService initializing...');
    this.connect();
  }

  private connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('⚠️ WebSocket already connected, skipping');
      return;
    }

    // Determine WebSocket URL based on current location (uses nginx proxy)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/gamification`;

    console.log('🔌 Connecting to gamification WebSocket:', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('✅ Gamification WebSocket connected');
        this.clearReconnectTimer();

        // Emit connection event
        this.eventsSubject.next({
          type: 'socket_connected',
          data: { message: 'WebSocket connection established' },
          timestamp: Date.now()
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket event received:', message.type, message);
          this.eventsSubject.next(message);
        } catch (err) {
          console.error('❌ Error parsing WebSocket message:', err);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ Gamification WebSocket error:', error);
      };

      this.socket.onclose = (event) => {
        console.log('🔌 Gamification WebSocket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        // Emit disconnection event
        this.eventsSubject.next({
          type: 'socket_disconnected',
          data: {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          },
          timestamp: Date.now()
        });

        // Only reconnect if not intentional disconnect
        if (!this.isIntentionalDisconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('❌ Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    console.log(`🔄 Scheduling reconnect in ${this.reconnectInterval / 1000}s...`);
    this.reconnectTimer = window.setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  public send(command: string, data: any = {}): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload = { command, ...data };
      this.socket.send(JSON.stringify(payload));
      console.log('📤 Sent WebSocket command:', command, data);
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send command:', command);
    }
  }

  public subscribe(topics: string[]): void {
    console.log('📋 Subscribing to topics:', topics);
    this.send('subscribe', { topics });
  }

  public ping(): void {
    this.send('ping');
  }

  public getStats(): void {
    this.send('get_stats');
  }

  public disconnect(): void {
    console.log('🔌 Intentionally disconnecting WebSocket');
    this.isIntentionalDisconnect = true;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
  }

  public reconnect(): void {
    console.log('🔄 Manual reconnect requested');
    this.isIntentionalDisconnect = false;
    this.disconnect();
    this.connect();
  }

  public getConnectionState(): string {
    if (!this.socket) {
      return 'CLOSED';
    }
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
