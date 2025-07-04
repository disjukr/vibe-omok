import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Lobby } from './lobby';
import { GameRoom } from './gameroom';
import { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Server-Sent Events 핸들러 (WebSocket 대신)
app.get('/events', async (c) => {
  // 로비 Durable Object에 SSE 연결 생성 요청
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobbyStub = c.env.LOBBY.get(lobbyId);
  
  return lobbyStub.fetch('http://localhost/events', {
    headers: { 
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
});

// CORS 설정
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 로비 API
app.post('/api/lobby/join', async (c) => {
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  return lobby.fetch(new Request('http://localhost/join', {
    method: 'POST',
    body: JSON.stringify(await c.req.json()),
    headers: { 'Content-Type': 'application/json' }
  }));
});

app.post('/api/lobby/leave', async (c) => {
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  return lobby.fetch(new Request('http://localhost/leave', {
    method: 'POST',
    body: JSON.stringify(await c.req.json()),
    headers: { 'Content-Type': 'application/json' }
  }));
});

app.post('/api/lobby/chat', async (c) => {
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  return lobby.fetch(new Request('http://localhost/chat', {
    method: 'POST',
    body: JSON.stringify(await c.req.json()),
    headers: { 'Content-Type': 'application/json' }
  }));
});

app.get('/api/lobby/chat-history', async (c) => {
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  return lobby.fetch(new Request('http://localhost/chat-history'));
});

app.get('/api/lobby/debug', async (c) => {
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  return lobby.fetch(new Request('http://localhost/debug'));
});

app.get('/api/rooms', async (c) => {
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  return lobby.fetch(new Request('http://localhost/rooms'));
});

// 방 API
app.post('/api/room/create', async (c) => {
  const { playerId, roomName, playerName } = await c.req.json();
  const roomId = crypto.randomUUID();
  
  // 게임룸 생성
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  const createResult = await gameRoom.fetch(new Request('http://localhost/create', {
    method: 'POST',
    body: JSON.stringify({ roomId, roomName, creatorName: playerName }),
    headers: { 'Content-Type': 'application/json' }
  }));
  
  if (!createResult.ok) {
    return createResult;
  }
  
  // 플레이어를 방에 추가
  const joinResult = await gameRoom.fetch(new Request('http://localhost/join', {
    method: 'POST',
    body: JSON.stringify({ playerId, playerName, asSpectator: false }),
    headers: { 'Content-Type': 'application/json' }
  }));
  
  if (!joinResult.ok) {
    return joinResult;
  }
  
  const joinData = await joinResult.json();
  
  // 로비에 방 정보 업데이트
  const lobbyId = c.env.LOBBY.idFromName('main');
  const lobby = c.env.LOBBY.get(lobbyId);
  await lobby.fetch(new Request('http://localhost/update-room', {
    method: 'POST',
    body: JSON.stringify({
      roomInfo: {
        id: roomId,
        name: roomName,
        creator: playerName,
        playerCount: joinData.gameState.players.length,
        spectatorCount: joinData.gameState.spectators.length,
        gameState: joinData.gameState.gameState,
        createdAt: joinData.gameState.createdAt
      }
    }),
    headers: { 'Content-Type': 'application/json' }
  }));
  
  return Response.json({ success: true, roomId, gameState: joinData.gameState });
});

app.post('/api/room/join', async (c) => {
  const { playerId, roomId, asSpectator, playerName } = await c.req.json();
  
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  const result = await gameRoom.fetch(new Request('http://localhost/join', {
    method: 'POST',
    body: JSON.stringify({ playerId, playerName, asSpectator }),
    headers: { 'Content-Type': 'application/json' }
  }));
  
  if (result.ok) {
    const data = await result.json();
    
    // 로비에 방 정보 업데이트
    const lobbyId = c.env.LOBBY.idFromName('main');
    const lobby = c.env.LOBBY.get(lobbyId);
    await lobby.fetch(new Request('http://localhost/update-room', {
      method: 'POST',
      body: JSON.stringify({
        roomInfo: {
          id: roomId,
          name: data.gameState.name,
          creator: data.gameState.creator,
          playerCount: data.gameState.players.length,
          spectatorCount: data.gameState.spectators.length,
          gameState: data.gameState.gameState,
          createdAt: data.gameState.createdAt
        }
      }),
      headers: { 'Content-Type': 'application/json' }
    }));
    
    return Response.json({ success: true, gameState: data.gameState });
  }
  
  return result;
});

app.post('/api/room/leave', async (c) => {
  const { playerId, roomId } = await c.req.json();
  
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  const result = await gameRoom.fetch(new Request('http://localhost/leave', {
    method: 'POST',
    body: JSON.stringify({ playerId }),
    headers: { 'Content-Type': 'application/json' }
  }));
  
  if (result.ok) {
    const data = await result.json();
    
    // 로비에 방 정보 업데이트
    const lobbyId = c.env.LOBBY.idFromName('main');
    const lobby = c.env.LOBBY.get(lobbyId);
    
    if (data.isEmpty) {
      await lobby.fetch(new Request('http://localhost/update-room', {
        method: 'POST',
        body: JSON.stringify({
          roomInfo: { id: roomId, playerCount: 0, spectatorCount: 0 }
        }),
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }
  
  return result;
});

app.post('/api/room/move', async (c) => {
  const { playerId, roomId, row, col } = await c.req.json();
  
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  return gameRoom.fetch(new Request('http://localhost/move', {
    method: 'POST',
    body: JSON.stringify({ playerId, row, col }),
    headers: { 'Content-Type': 'application/json' }
  }));
});

app.post('/api/room/chat', async (c) => {
  const { playerId, roomId, message } = await c.req.json();
  
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  return gameRoom.fetch(new Request('http://localhost/chat', {
    method: 'POST',
    body: JSON.stringify({ playerId, message }),
    headers: { 'Content-Type': 'application/json' }
  }));
});

app.post('/api/room/reset', async (c) => {
  const { roomId } = await c.req.json();
  
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  return gameRoom.fetch(new Request('http://localhost/reset', {
    method: 'POST'
  }));
});

app.get('/api/room/:roomId/state', async (c) => {
  const roomId = c.req.param('roomId');
  
  const gameRoomId = c.env.GAME_ROOM.idFromName(roomId);
  const gameRoom = c.env.GAME_ROOM.get(gameRoomId);
  
  return gameRoom.fetch(new Request('http://localhost/state'));
});

// 기본 라우트
app.get('/', (c) => {
  return c.json({ message: '오목 게임 서버가 실행 중입니다! (Cloudflare Workers)' });
});

export { Lobby, GameRoom };
export default app;
