import { registry } from "./registry.js";
import { Hono } from "hono";
import { cors } from "hono/cors";

interface RoomListItem {
  id: string;
  name: string;
  creator: string;
  playerCount: number;
  spectatorCount: number;
  gameState: string;
  createdAt: string;
}

// RivetKit 서버 및 클라이언트 생성
const { client, serve } = registry.createServer();

// Hono 앱 설정
const app = new Hono();

// CORS 설정
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 기본 상태 관리
const rooms = new Map<string, string>(); // roomId -> actorId 매핑
const players = new Map<string, { name: string; roomId?: string }>(); // playerId -> 플레이어 정보

// 로비 참가 API
app.post('/api/lobby/join', async (c) => {
  const { playerId, playerName } = await c.req.json();
  
  try {
    const lobbyActor = client.lobby.getOrCreate("main");
    const result = await lobbyActor.joinLobby(playerId, playerName);
    
    if (result.success) {
      players.set(playerId, { name: playerName });
      return c.json({ 
        success: true, 
        chatHistory: result.chatHistory,
        rooms: result.rooms
      });
    } else {
      return c.json({ success: false, error: "로비 참가 실패" }, 400);
    }
  } catch (error) {
    console.error('로비 참가 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 로비 나가기 API
app.post('/api/lobby/leave', async (c) => {
  const { playerId } = await c.req.json();
  
  try {
    const lobbyActor = client.lobby.getOrCreate("main");
    await lobbyActor.leaveLobby(playerId);
    
    players.delete(playerId);
    return c.json({ success: true });
  } catch (error) {
    console.error('로비 나가기 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 로비 채팅 API
app.post('/api/lobby/chat', async (c) => {
  const { playerId, message } = await c.req.json();
  
  try {
    const lobbyActor = client.lobby.getOrCreate("main");
    const result = await lobbyActor.sendChatMessage(playerId, message);
    
    return c.json(result);
  } catch (error) {
    console.error('로비 채팅 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 생성 API
app.post('/api/room/create', async (c) => {
  const { playerId, roomName } = await c.req.json();
  
  try {
    const player = players.get(playerId);
    if (!player) {
      return c.json({ success: false, error: "플레이어를 찾을 수 없습니다." }, 400);
    }
    
    const roomId = crypto.randomUUID();
    const roomActor = client.gameRoom.getOrCreate(roomId);
    
    // 방 초기화
    await roomActor.initializeRoom(roomId, roomName, player.name);
    
    // 플레이어를 방에 추가
    const joinResult = await roomActor.joinRoom(playerId, player.name, false);
    
    if (joinResult.success) {
      rooms.set(roomId, roomId);
      players.set(playerId, { ...player, roomId });
      
      // 로비에 방 목록 업데이트
      await updateRoomList();
      
      return c.json({ success: true, roomId, roomState: joinResult.roomState });
    } else {
      return c.json({ success: false, error: joinResult.error }, 400);
    }
  } catch (error) {
    console.error('방 생성 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 참가 API
app.post('/api/room/join', async (c) => {
  const { playerId, roomId, asSpectator } = await c.req.json();
  
  try {
    const player = players.get(playerId);
    if (!player) {
      return c.json({ success: false, error: "플레이어를 찾을 수 없습니다." }, 400);
    }
    
    const roomActor = client.gameRoom.getOrCreate(roomId);
    const result = await roomActor.joinRoom(playerId, player.name, asSpectator);
    
    if (result.success) {
      players.set(playerId, { ...player, roomId });
      await updateRoomList();
      
      return c.json({ success: true, roomState: result.roomState });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('방 참가 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 나가기 API
app.post('/api/room/leave', async (c) => {
  const { playerId, roomId } = await c.req.json();
  
  try {
    const roomActor = client.gameRoom.getOrCreate(roomId);
    const result = await roomActor.leaveRoom(playerId);
    
    if (result.success) {
      const player = players.get(playerId);
      if (player) {
        players.set(playerId, { ...player, roomId: undefined });
      }
      
      if (result.isEmpty) {
        rooms.delete(roomId);
      }
      
      await updateRoomList();
      
      return c.json({ success: true });
    } else {
      return c.json({ success: false, error: "방 나가기 실패" }, 400);
    }
  } catch (error) {
    console.error('방 나가기 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 게임 수 두기 API
app.post('/api/room/move', async (c) => {
  const { playerId, roomId, row, col } = await c.req.json();
  
  try {
    const roomActor = client.gameRoom.getOrCreate(roomId);
    const result = await roomActor.makeMove(playerId, row, col);
    
    if (result.success) {
      await updateRoomList();
    }
    
    return c.json(result);
  } catch (error) {
    console.error('게임 수 두기 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 채팅 API
app.post('/api/room/chat', async (c) => {
  const { playerId, roomId, message } = await c.req.json();
  
  try {
    const roomActor = client.gameRoom.getOrCreate(roomId);
    const result = await roomActor.sendChatMessage(playerId, message);
    
    return c.json(result);
  } catch (error) {
    console.error('방 채팅 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 게임 리셋 API
app.post('/api/room/reset', async (c) => {
  const { roomId } = await c.req.json();
  
  try {
    const roomActor = client.gameRoom.getOrCreate(roomId);
    const result = await roomActor.resetGame();
    
    if (result.success) {
      await updateRoomList();
    }
    
    return c.json(result);
  } catch (error) {
    console.error('게임 리셋 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 목록 가져오기 API
app.get('/api/rooms', async (c) => {
  try {
    const roomList: RoomListItem[] = [];
    
    for (const [roomId] of rooms) {
      const roomActor = client.gameRoom.getOrCreate(roomId);
      const roomState = await roomActor.getRoomState();
      
      roomList.push({
        id: roomState.id,
        name: roomState.name,
        creator: roomState.creator,
        playerCount: roomState.players.length,
        spectatorCount: roomState.spectators.length,
        gameState: roomState.gameState,
        createdAt: roomState.createdAt
      });
    }
    
    return c.json({ success: true, rooms: roomList });
  } catch (error) {
    console.error('방 목록 가져오기 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 로비 채팅 히스토리 가져오기 API
app.get('/api/lobby/chat-history', async (c) => {
  try {
    const lobbyActor = client.lobby.getOrCreate("main");
    const chatHistory = await lobbyActor.getChatHistory();
    
    return c.json({ success: true, messages: chatHistory });
  } catch (error) {
    console.error('로비 채팅 히스토리 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 상태 가져오기 API
app.get('/api/room/:roomId/state', async (c) => {
  const roomId = c.req.param('roomId');
  
  try {
    const roomActor = client.gameRoom.getOrCreate(roomId);
    const roomState = await roomActor.getRoomState();
    
    return c.json({ success: true, roomState });
  } catch (error) {
    console.error('방 상태 가져오기 오류:', error);
    return c.json({ success: false, error: "서버 오류" }, 500);
  }
});

// 방 목록 업데이트 헬퍼 함수
async function updateRoomList() {
  try {
    const roomList: RoomListItem[] = [];
    
    for (const [roomId] of rooms) {
      const roomActor = client.gameRoom.getOrCreate(roomId);
      const roomState = await roomActor.getRoomState();
      
      roomList.push({
        id: roomState.id,
        name: roomState.name,
        creator: roomState.creator,
        playerCount: roomState.players.length,
        spectatorCount: roomState.spectators.length,
        gameState: roomState.gameState,
        createdAt: roomState.createdAt
      });
    }
    
    const lobbyActor = client.lobby.getOrCreate("main");
    await lobbyActor.updateRoomList(roomList);
  } catch (error) {
    console.error('방 목록 업데이트 오류:', error);
  }
}

// 서버 시작
serve(app);
