// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Мок для Tauri API window
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    onResized: vi.fn(() => ({ then: vi.fn() })),
    onMoved: vi.fn(() => ({ then: vi.fn() })),
  }),
}));

// Мок для Tauri Store
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: class MockStore {
    private data: Map<string, any> = new Map();
    
    async get(key: string) {
      return this.data.get(key) ?? null;
    }
    
    async set(key: string, value: any) {
      this.data.set(key, value);
    }
    
    async delete(key: string) {
      this.data.delete(key);
    }
    
    async save() {}
    
    async keys() {
      return Array.from(this.data.keys());
    }
    
    static async load(fileName: string) {
      void fileName;
      return new MockStore();
    }
  },
}));

// Мок для WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readyState: number = WebSocket.OPEN;
  
  constructor(url: string) {
    void url;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data: string) {
    console.log('MockWebSocket send:', data);
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
  }
}

global.WebSocket = MockWebSocket as any;

// Мок для sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Мок для navigator.userAgent
Object.defineProperty(window.navigator, 'userAgent', {
  value: 'Vitest Test Runner',
  configurable: true,
});

// Исправленная функция randomUUID
if (!crypto.randomUUID) {
  crypto.randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return uuid as `${string}-${string}-${string}-${string}-${string}`;
  };
}