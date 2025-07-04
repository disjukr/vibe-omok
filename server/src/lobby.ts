import { ChatMessage, RoomInfo } from './types';

export class Lobby {
  private state: DurableObjectState;
  private players: Map<string, { name: string }> = new Map();
  private chatHistory: ChatMessage[] = [];
  private rooms: Map<string, RoomInfo> = new Map();
  private initialized = false;
  private sseConnections: Set<WritableStreamDefaultWriter> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 상태 복원 (처음 한 번만)
    if (!this.initialized) {
      await this.loadState();
      this.initialized = true;
    }

    try {
      switch (path) {
        case '/events':
          return this.handleSSE(request);
        case '/join':
          return this.handleJoin(request);
        case '/leave':
          return this.handleLeave(request);
        case '/chat':
          return this.handleChat(request);
        case '/chat-history':
          return this.handleChatHistory();
        case '/rooms':
          return this.handleGetRooms();
        case '/update-room':
          return this.handleUpdateRoom(request);
        case '/debug':
          return this.handleDebug();
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Lobby error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  private async loadState() {
    try {
      const data = await this.state.storage.get(['players', 'chatHistory', 'rooms']);
      console.log('Loading state:', data);
      
      this.players = new Map(data.get('players') || []);
      this.chatHistory = data.get('chatHistory') || [];
      this.rooms = new Map(data.get('rooms') || []);
      
      console.log('State loaded:', {
        playersCount: this.players.size,
        chatHistoryCount: this.chatHistory.length,
        roomsCount: this.rooms.size
      });
    } catch (error) {
      console.error('Error loading state:', error);
      // 기본값으로 초기화
      this.players = new Map();
      this.chatHistory = [];
      this.rooms = new Map();
    }
  }

  private async saveState() {
    try {
      const stateData = {
        players: Array.from(this.players.entries()),
        chatHistory: this.chatHistory,
        rooms: Array.from(this.rooms.entries())
      };
      
      console.log('Saving state:', {
        playersCount: this.players.size,
        chatHistoryCount: this.chatHistory.length,
        roomsCount: this.rooms.size
      });
      
      await this.state.storage.put(stateData);
      console.log('State saved successfully');
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  private async handleJoin(request: Request): Promise<Response> {
    const { playerId, playerName } = await request.json();
    
    console.log('Lobby handleJoin:', { playerId, playerName });
    this.players.set(playerId, { name: playerName });
    await this.saveState();
    console.log('Players after join:', Array.from(this.players.entries()));

    return Response.json({
      success: true,
      chatHistory: this.chatHistory,
      rooms: Array.from(this.rooms.values())
    });
  }

  private async handleLeave(request: Request): Promise<Response> {
    const { playerId } = await request.json();
    
    this.players.delete(playerId);
    await this.saveState();

    return Response.json({ success: true });
  }

  private async handleChat(request: Request): Promise<Response> {
    const { playerId, message } = await request.json();
    console.log('Lobby handleChat:', { playerId, message });
    console.log('Current players:', Array.from(this.players.entries()));
    const player = this.players.get(playerId);

    if (!player) {
      console.log('Player not found:', playerId);
      return Response.json({ success: false, error: '플레이어를 찾을 수 없습니다.' }, { status: 400 });
    }

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      playerName: player.name,
      message,
      timestamp: new Date().toISOString()
    };

    this.chatHistory.push(chatMessage);
    
    // 최근 100개 메시지만 유지
    if (this.chatHistory.length > 100) {
      this.chatHistory = this.chatHistory.slice(-100);
    }

    await this.saveState();
    
    // 채팅 메시지를 모든 클라이언트에 브로드캐스트
    this.broadcastToAll({
      type: 'lobby-chat',
      message: chatMessage
    });

    return Response.json({ success: true, message: chatMessage });
  }

  private async handleChatHistory(): Promise<Response> {
    return Response.json({ success: true, messages: this.chatHistory });
  }

  private async handleGetRooms(): Promise<Response> {
    return Response.json({ success: true, rooms: Array.from(this.rooms.values()) });
  }

  private async handleUpdateRoom(request: Request): Promise<Response> {
    const { roomInfo } = await request.json();
    
    if (roomInfo.playerCount === 0 && roomInfo.spectatorCount === 0) {
      // 빈 방 삭제
      this.rooms.delete(roomInfo.id);
    } else {
      // 방 정보 업데이트
      this.rooms.set(roomInfo.id, roomInfo);
    }

    await this.saveState();
    
    // 방 목록 업데이트를 모든 클라이언트에 브로드캐스트
    this.broadcastToAll({
      type: 'rooms-updated',
      rooms: Array.from(this.rooms.values())
    });

    return Response.json({ success: true });
  }



  private handleDebug(): Response {
    return Response.json({
      sseConnectionCount: this.sseConnections.size,
      playersCount: this.players.size,
      chatHistoryCount: this.chatHistory.length,
      roomsCount: this.rooms.size
    });
  }

  private handleSSE(request: Request): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    
    // SSE 연결 추가
    this.sseConnections.add(writer);
    console.log('SSE 연결 추가됨, 총 연결 수:', this.sseConnections.size);
    
    // 초기 연결 메시지 전송
    writer.write(new TextEncoder().encode('data: {"type":"connected"}\n\n'));
    
    // 연결 종료 처리는 클라이언트가 연결을 끊을 때 자동으로 처리됨
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  }

  private broadcastToAll(message: any) {
    const messageString = `data: ${JSON.stringify(message)}\n\n`;
    const messageBytes = new TextEncoder().encode(messageString);
    
    console.log(`브로드캐스트 중: ${JSON.stringify(message)}, SSE 연결 수: ${this.sseConnections.size}`);
    
    for (const writer of this.sseConnections) {
      try {
        writer.write(messageBytes);
        console.log('메시지 전송 성공');
      } catch (error) {
        console.log('메시지 전송 실패:', error);
        // 연결이 끊어진 SSE는 제거
        this.sseConnections.delete(writer);
      }
    }
  }
}
