import { WebSocket } from 'ws';

export interface WsMessage {
  type: string;  // было message_type
  request_id?: string;
  data?: any;
  guild_id?: number;
  room_id?: number;
  session_token?: string;
}

export interface WsResponse {
  type: 'success' | 'error' | 'pong' | 'message';
  request_id?: string;
  data?: any;
  error?: string;
}

export class WebSocketTestClient {
  private ws?: WebSocket;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private responseQueue: Map<string, (response: WsResponse) => void> = new Map();

  constructor(private url: string = 'ws://localhost:9001') {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to WebSocket server');
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }

  private handleMessage(message: WsResponse): void {
    // Handle response by request_id
    if (message.request_id && this.responseQueue.has(message.request_id)) {
      const resolver = this.responseQueue.get(message.request_id)!;
      this.responseQueue.delete(message.request_id);
      resolver(message);
    }

    // Handle message by type
    if (message.type && this.messageHandlers.has(message.type)) {
      const handler = this.messageHandlers.get(message.type)!;
      handler(message);
    }
  }

  async send(message: WsMessage): Promise<WsResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseQueue.delete(message.request_id || '');
        reject(new Error(`Timeout waiting for response to ${message.type}`));
      }, 5000);

      if (message.request_id) {
        this.responseQueue.set(message.request_id, (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      } else {
        // If no request_id, resolve immediately after sending
        clearTimeout(timeout);
        resolve({ type: 'success', data: { sent: true } });
      }

      this.ws!.send(JSON.stringify(message));
    });
  }

  onMessageType(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  async close(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  async waitForConnection(): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket is not initialized');
    }
    
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.ws) {
          clearInterval(checkInterval);
          reject(new Error('WebSocket is not initialized'));
          return;
        }
        
        if (this.ws.readyState === WebSocket.OPEN) {
          clearInterval(checkInterval);
          resolve();
        } else if (this.ws.readyState === WebSocket.CLOSED) {
          clearInterval(checkInterval);
          reject(new Error('WebSocket connection closed'));
        }
      }, 100);
    });
  }

  async ping(): Promise<WsResponse> {
    return this.send({
      type: 'ping',  // было message_type
      request_id: `ping-${Date.now()}`
    });
  }

  async login(login: string, password: string): Promise<WsResponse> {
    return this.send({
      type: 'login',  // было message_type
      request_id: `login-${Date.now()}`,
      data: {
        login,
        password,
        ip_address: '127.0.0.1',
        user_agent: 'Playwright Test'
      }
    });
  }
}

// Helper function to create test WebSocket client
export async function createTestWebSocketClient(): Promise<WebSocketTestClient> {
  const client = new WebSocketTestClient();
  await client.connect();
  return client;
}