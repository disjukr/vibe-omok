export interface Player {
  id: string;
  name: string;
  color?: 'black' | 'white';
  role: 'player' | 'spectator';
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  creator: string;
  playerCount: number;
  spectatorCount: number;
  gameState: 'waiting' | 'playing' | 'finished';
  createdAt: string;
}

export interface GameState {
  id: string;
  name: string;
  creator: string;
  players: Player[];
  spectators: Player[];
  board: (string | null)[][];
  currentPlayer: 'black' | 'white';
  gameState: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  chatHistory: ChatMessage[];
  createdAt: string;
}

export interface Env {
  LOBBY: DurableObjectNamespace;
  GAME_ROOM: DurableObjectNamespace;
}

// Cloudflare Workers 글로벌 타입 확장
declare global {
  interface DurableObjectState {
    storage: DurableObjectStorage;
  }
  
  interface DurableObjectStorage {
    get<T = any>(key: string): Promise<T | undefined>;
    get<T = any>(keys: string[]): Promise<Map<string, T>>;
    put<T = any>(key: string, value: T): Promise<void>;
    put<T = any>(entries: Record<string, T>): Promise<void>;
    delete(key: string): Promise<boolean>;
  }
  
  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
  }
  
  interface DurableObjectId {
    toString(): string;
  }
  
  interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
  }
  
  // WebSocket 타입
  const WebSocketPair: {
    new (): [WebSocket, WebSocket];
  };
  
  interface WebSocket {
    accept(): void;
    send(message: string): void;
    close(): void;
    addEventListener(type: 'message' | 'close' | 'error', listener: (event: any) => void): void;
  }
}
