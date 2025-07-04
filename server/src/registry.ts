import { actor, setup } from "@rivetkit/actor";

// 게임 타입 정의
interface Player {
  id: string;
  name: string;
  color?: 'black' | 'white';
  role: 'player' | 'spectator';
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

interface GameState {
  board: (string | null)[][];
  currentPlayer: 'black' | 'white';
  gameState: 'waiting' | 'playing' | 'finished';
  winner: string | null;
}

interface RoomState {
  id: string;
  name: string;
  creator: string;
  players: Player[];
  spectators: Player[];
  gameState: GameState;
  chatHistory: ChatMessage[];
  createdAt: string;
}

// 로비 Actor
export const lobby = actor({
  state: {
    players: [] as Player[],
    chatHistory: [] as ChatMessage[],
    rooms: [] as { id: string; name: string; creator: string; playerCount: number; spectatorCount: number; gameState: string; createdAt: string; }[]
  },
  actions: {
    // 플레이어 참가
    joinLobby: (c, playerId: string, playerName: string) => {
      const existingPlayer = c.state.players.find(p => p.id === playerId);
      if (!existingPlayer) {
        c.state.players.push({
          id: playerId,
          name: playerName,
          role: 'player'
        });
      }
      
      c.broadcast("playerJoined", { playerId, playerName });
      return {
        success: true,
        chatHistory: c.state.chatHistory,
        rooms: c.state.rooms
      };
    },
    
    // 플레이어 나가기
    leaveLobby: (c, playerId: string) => {
      const playerIndex = c.state.players.findIndex(p => p.id === playerId);
      if (playerIndex >= 0) {
        const player = c.state.players[playerIndex];
        c.state.players.splice(playerIndex, 1);
        c.broadcast("playerLeft", { playerId, playerName: player.name });
      }
      return { success: true };
    },
    
    // 채팅 메시지 보내기
    sendChatMessage: (c, playerId: string, message: string) => {
      const player = c.state.players.find(p => p.id === playerId);
      if (!player) return { success: false, error: "플레이어를 찾을 수 없습니다." };
      
      const chatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        playerId,
        playerName: player.name,
        message,
        timestamp: new Date().toISOString()
      };
      
      c.state.chatHistory.push(chatMessage);
      c.broadcast("chatMessage", chatMessage);
      
      return { success: true, message: chatMessage };
    },
    
    // 방 목록 업데이트
    updateRoomList: (c, rooms: any[]) => {
      c.state.rooms = rooms;
      c.broadcast("roomListUpdated", rooms);
      return { success: true };
    },
    
    // 방 목록 가져오기
    getRoomList: (c) => c.state.rooms,
    
    // 채팅 히스토리 가져오기
    getChatHistory: (c) => c.state.chatHistory
  }
});

// 게임 방 Actor
export const gameRoom = actor({
  state: {
    id: "",
    name: "",
    creator: "",
    players: [] as Player[],
    spectators: [] as Player[],
    board: Array(19).fill(null).map(() => Array(19).fill(null)) as (string | null)[][],
    currentPlayer: 'black' as 'black' | 'white',
    gameState: 'waiting' as 'waiting' | 'playing' | 'finished',
    winner: null as string | null,
    chatHistory: [] as ChatMessage[],
    createdAt: ""
  },
  actions: {
    // 방 초기화
    initializeRoom: (c, roomId: string, roomName: string, creatorName: string) => {
      c.state.id = roomId;
      c.state.name = roomName;
      c.state.creator = creatorName;
      c.state.createdAt = new Date().toISOString();
      return { success: true };
    },
    
    // 플레이어 참가
    joinRoom: (c, playerId: string, playerName: string, asSpectator: boolean = false) => {
      // 이미 참가한 플레이어 확인
      const existingPlayer = [...c.state.players, ...c.state.spectators].find(p => p.id === playerId);
      if (existingPlayer) {
        return { success: false, error: "이미 참가한 플레이어입니다." };
      }
      
      if (asSpectator || c.state.players.length >= 2) {
        // 관전자로 참가
        c.state.spectators.push({
          id: playerId,
          name: playerName,
          role: 'spectator'
        });
      } else {
        // 플레이어로 참가
        const color = c.state.players.length === 0 ? 'black' : 'white';
        c.state.players.push({
          id: playerId,
          name: playerName,
          color,
          role: 'player'
        });
        
        // 2명이 되면 게임 시작
        if (c.state.players.length === 2) {
          c.state.gameState = 'playing';
        }
      }
      
      c.broadcast("playerJoined", { playerId, playerName, role: asSpectator ? 'spectator' : 'player' });
      
      return {
        success: true,
        roomState: c.state
      };
    },
    
    // 플레이어 나가기
    leaveRoom: (c, playerId: string) => {
      const playerIndex = c.state.players.findIndex(p => p.id === playerId);
      const spectatorIndex = c.state.spectators.findIndex(p => p.id === playerId);
      
      let playerName = "";
      
      if (playerIndex >= 0) {
        playerName = c.state.players[playerIndex].name;
        c.state.players.splice(playerIndex, 1);
        
        // 플레이어가 나가면 게임 상태 변경
        if (c.state.players.length === 1 && c.state.gameState === 'playing') {
          c.state.gameState = 'waiting';
        }
      } else if (spectatorIndex >= 0) {
        playerName = c.state.spectators[spectatorIndex].name;
        c.state.spectators.splice(spectatorIndex, 1);
      }
      
      c.broadcast("playerLeft", { playerId, playerName });
      
      // 방이 비어있으면 삭제 신호
      const isEmpty = c.state.players.length === 0 && c.state.spectators.length === 0;
      
      return { success: true, isEmpty };
    },
    
    // 게임 수 두기
    makeMove: (c, playerId: string, row: number, col: number) => {
      // 게임 상태 확인
      if (c.state.gameState !== 'playing') {
        return { success: false, error: "게임이 진행 중이 아닙니다." };
      }
      
      // 플레이어 확인
      const player = c.state.players.find(p => p.id === playerId);
      if (!player || player.color !== c.state.currentPlayer) {
        return { success: false, error: "차례가 아닙니다." };
      }
      
      // 이미 돌이 있는지 확인
      if (c.state.board[row][col] !== null) {
        return { success: false, error: "이미 돌이 놓여있습니다." };
      }
      
      // 돌 놓기
      c.state.board[row][col] = c.state.currentPlayer;
      
      // 승리 조건 확인
      const isWin = checkWin(c.state.board, row, col, c.state.currentPlayer);
      if (isWin) {
        c.state.winner = c.state.currentPlayer;
        c.state.gameState = 'finished';
      } else {
        c.state.currentPlayer = c.state.currentPlayer === 'black' ? 'white' : 'black';
      }
      
      c.broadcast("moveMade", {
        playerId,
        row,
        col,
        color: player.color,
        currentPlayer: c.state.currentPlayer,
        gameState: c.state.gameState,
        winner: c.state.winner
      });
      
      return { success: true };
    },
    
    // 게임 리셋
    resetGame: (c) => {
      if (c.state.gameState !== 'finished') {
        return { success: false, error: "게임이 끝나지 않았습니다." };
      }
      
      c.state.board = Array(19).fill(null).map(() => Array(19).fill(null));
      c.state.currentPlayer = 'black';
      c.state.gameState = c.state.players.length === 2 ? 'playing' : 'waiting';
      c.state.winner = null;
      
      c.broadcast("gameReset", c.state);
      
      return { success: true };
    },
    
    // 채팅 메시지 보내기
    sendChatMessage: (c, playerId: string, message: string) => {
      const allPlayers = [...c.state.players, ...c.state.spectators];
      const player = allPlayers.find(p => p.id === playerId);
      
      if (!player) {
        return { success: false, error: "플레이어를 찾을 수 없습니다." };
      }
      
      const chatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        playerId,
        playerName: player.name,
        message,
        timestamp: new Date().toISOString()
      };
      
      c.state.chatHistory.push(chatMessage);
      c.broadcast("chatMessage", chatMessage);
      
      return { success: true, message: chatMessage };
    },
    
    // 방 상태 가져오기
    getRoomState: (c) => c.state,
    
    // 채팅 히스토리 가져오기
    getChatHistory: (c) => c.state.chatHistory
  }
});

// 승리 조건 확인 함수
function checkWin(board: (string | null)[][], row: number, col: number, player: string): boolean {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    let count = 1;
    
    // 양방향으로 확인
    for (let i = 1; i < 5; i++) {
      const newRow = row + dx * i;
      const newCol = col + dy * i;
      if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && board[newRow][newCol] === player) {
        count++;
      } else {
        break;
      }
    }
    
    for (let i = 1; i < 5; i++) {
      const newRow = row - dx * i;
      const newCol = col - dy * i;
      if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && board[newRow][newCol] === player) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 5) return true;
  }
  
  return false;
}

export const registry = setup({
  use: { lobby, gameRoom }
});
