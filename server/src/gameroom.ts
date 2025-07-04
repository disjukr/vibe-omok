import { Player, ChatMessage, GameState } from './types';

export class GameRoom {
  private state: DurableObjectState;
  private gameState: GameState;
  private initialized = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.gameState = {
      id: '',
      name: '',
      creator: '',
      players: [],
      spectators: [],
      board: Array(19).fill(null).map(() => Array(19).fill(null)),
      currentPlayer: 'black',
      gameState: 'waiting',
      winner: null,
      chatHistory: [],
      createdAt: ''
    };
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
        case '/create':
          return this.handleCreate(request);
        case '/join':
          return this.handleJoin(request);
        case '/leave':
          return this.handleLeave(request);
        case '/move':
          return this.handleMove(request);
        case '/chat':
          return this.handleChat(request);
        case '/reset':
          return this.handleReset();
        case '/state':
          return this.handleGetState();
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('GameRoom error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  private async loadState() {
    try {
      const data = await this.state.storage.get('gameState');
      console.log('GameRoom loading state:', data ? 'found' : 'not found');
      if (data) {
        this.gameState = data as GameState;
        console.log('GameRoom state loaded:', this.gameState.id);
      }
    } catch (error) {
      console.error('GameRoom error loading state:', error);
    }
  }

  private async saveState() {
    try {
      await this.state.storage.put('gameState', this.gameState);
      console.log('GameRoom state saved:', this.gameState.id);
    } catch (error) {
      console.error('GameRoom error saving state:', error);
    }
  }

  private async handleCreate(request: Request): Promise<Response> {
    const { roomId, roomName, creatorName } = await request.json();

    this.gameState = {
      id: roomId,
      name: roomName,
      creator: creatorName,
      players: [],
      spectators: [],
      board: Array(19).fill(null).map(() => Array(19).fill(null)),
      currentPlayer: 'black',
      gameState: 'waiting',
      winner: null,
      chatHistory: [],
      createdAt: new Date().toISOString()
    };

    await this.saveState();

    return Response.json({ success: true, gameState: this.gameState });
  }

  private async handleJoin(request: Request): Promise<Response> {
    const { playerId, playerName, asSpectator } = await request.json();

    // 이미 참가한 플레이어 확인
    const existingPlayer = [...this.gameState.players, ...this.gameState.spectators]
      .find(p => p.id === playerId);
    
    if (existingPlayer) {
      return Response.json({ success: false, error: '이미 참가한 플레이어입니다.' }, { status: 400 });
    }

    if (asSpectator || this.gameState.players.length >= 2) {
      // 관전자로 참가
      this.gameState.spectators.push({
        id: playerId,
        name: playerName,
        role: 'spectator'
      });
    } else {
      // 플레이어로 참가
      const color = this.gameState.players.length === 0 ? 'black' : 'white';
      this.gameState.players.push({
        id: playerId,
        name: playerName,
        color,
        role: 'player'
      });

      // 2명이 되면 게임 시작
      if (this.gameState.players.length === 2) {
        this.gameState.gameState = 'playing';
      }
    }

    await this.saveState();

    return Response.json({ success: true, gameState: this.gameState });
  }

  private async handleLeave(request: Request): Promise<Response> {
    const { playerId } = await request.json();

    this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);
    this.gameState.spectators = this.gameState.spectators.filter(p => p.id !== playerId);

    // 플레이어가 나가면 게임 상태 변경
    if (this.gameState.players.length === 1 && this.gameState.gameState === 'playing') {
      this.gameState.gameState = 'waiting';
    }

    const isEmpty = this.gameState.players.length === 0 && this.gameState.spectators.length === 0;

    await this.saveState();

    return Response.json({ success: true, isEmpty });
  }

  private async handleMove(request: Request): Promise<Response> {
    const { playerId, row, col } = await request.json();

    // 게임 상태 확인
    if (this.gameState.gameState !== 'playing') {
      return Response.json({ success: false, error: '게임이 진행 중이 아닙니다.' }, { status: 400 });
    }

    // 플레이어 확인
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player || player.color !== this.gameState.currentPlayer) {
      return Response.json({ success: false, error: '차례가 아닙니다.' }, { status: 400 });
    }

    // 이미 돌이 있는지 확인
    if (this.gameState.board[row][col] !== null) {
      return Response.json({ success: false, error: '이미 돌이 놓여있습니다.' }, { status: 400 });
    }

    // 돌 놓기
    this.gameState.board[row][col] = this.gameState.currentPlayer;

    // 승리 조건 확인
    if (this.checkWin(row, col, this.gameState.currentPlayer)) {
      this.gameState.winner = this.gameState.currentPlayer;
      this.gameState.gameState = 'finished';
    } else {
      this.gameState.currentPlayer = this.gameState.currentPlayer === 'black' ? 'white' : 'black';
    }

    await this.saveState();

    return Response.json({ success: true });
  }

  private checkWin(row: number, col: number, player: string): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dx, dy] of directions) {
      let count = 1;

      // 양방향으로 확인
      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
            this.gameState.board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }

      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
            this.gameState.board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) return true;
    }

    return false;
  }

  private async handleChat(request: Request): Promise<Response> {
    const { playerId, message } = await request.json();
    
    const allPlayers = [...this.gameState.players, ...this.gameState.spectators];
    const player = allPlayers.find(p => p.id === playerId);

    if (!player) {
      return Response.json({ success: false, error: '플레이어를 찾을 수 없습니다.' }, { status: 400 });
    }

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      playerName: player.name,
      message,
      timestamp: new Date().toISOString()
    };

    this.gameState.chatHistory.push(chatMessage);

    // 최근 50개 메시지만 유지
    if (this.gameState.chatHistory.length > 50) {
      this.gameState.chatHistory = this.gameState.chatHistory.slice(-50);
    }

    await this.saveState();

    return Response.json({ success: true, message: chatMessage });
  }

  private async handleReset(): Promise<Response> {
    if (this.gameState.gameState !== 'finished') {
      return Response.json({ success: false, error: '게임이 끝나지 않았습니다.' }, { status: 400 });
    }

    this.gameState.board = Array(19).fill(null).map(() => Array(19).fill(null));
    this.gameState.currentPlayer = 'black';
    this.gameState.gameState = this.gameState.players.length === 2 ? 'playing' : 'waiting';
    this.gameState.winner = null;

    await this.saveState();

    return Response.json({ success: true });
  }

  private async handleGetState(): Promise<Response> {
    return Response.json({ success: true, gameState: this.gameState });
  }
}
