import { useState, useEffect, useCallback } from 'react';

export type GameState = 'lobby' | 'room' | 'game';

export interface Player {
  id: string;
  name: string;
  color?: 'black' | 'white';
  role: 'player' | 'spectator';
}

export interface Room {
  id: string;
  name: string;
  creator: string;
  playerCount: number;
  spectatorCount: number;
  gameState: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

export interface GameBoard {
  board: (string | null)[][];
  currentPlayer: 'black' | 'white';
  gameState: 'waiting' | 'playing' | 'finished';
  winner: string | null;
}

export interface RoomState {
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
}

const SERVER_URL = 'http://localhost:8080';

export const useGameClient = () => {
  const [playerId] = useState(() => crypto.randomUUID());
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [lobbyChatHistory, setLobbyChatHistory] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // 폴링을 위한 상태
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // 방 목록 새로고침
  const refreshRooms = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/rooms`);
      const result = await response.json();
      if (result.success) {
        setRooms(result.rooms);
      }
    } catch (error) {
      console.error('방 목록 새로고침 오류:', error);
    }
  }, []);

  // 로비 채팅 새로고침
  const refreshLobbyChat = useCallback(async () => {
    if (!isConnected) return;
    try {
      const response = await fetch(`${SERVER_URL}/api/lobby/chat-history`);
      const result = await response.json();
      if (result.success) {
        setLobbyChatHistory(result.messages);
      }
    } catch (error) {
      // 조용히 실패 - 채팅 히스토리는 중요하지 않음
    }
  }, [isConnected]);

  // 방 상태 새로고침
  const refreshRoomState = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/room/${roomId}/state`);
      const result = await response.json();
      if (result.success) {
        setCurrentRoom(result.roomState);
      }
    } catch (error) {
      console.error('방 상태 새로고침 오류:', error);
    }
  }, []);

  // 로비 참가
  const joinLobby = useCallback(async (name: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/lobby/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName: name })
      });
      
      const result = await response.json();
      if (result.success) {
        setPlayerName(name);
        setLobbyChatHistory(result.chatHistory || []);
        setRooms(result.rooms || []);
        setIsConnected(true);
        
        // 폴링 시작 (실시간 업데이트를 위해)
        const interval = setInterval(() => {
          refreshRooms();
          refreshLobbyChat();
        }, 2000);
        setPollingInterval(interval);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('로비 참가 오류:', error);
      return false;
    }
  }, [playerId, refreshRooms, refreshLobbyChat]);

  // 로비 채팅 보내기
  const sendLobbyChat = useCallback(async (message: string) => {
    try {
      await fetch(`${SERVER_URL}/api/lobby/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, message })
      });
      // 즉시 채팅 새로고침
      setTimeout(refreshLobbyChat, 100);
    } catch (error) {
      console.error('로비 채팅 오류:', error);
    }
  }, [playerId, refreshLobbyChat]);

  // 방 생성
  const createRoom = useCallback(async (roomName: string) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/room/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roomName })
      });
      
      const result = await response.json();
      if (result.success) {
        setCurrentRoom(result.roomState);
        setGameState('room');
        
        // 방 상태 폴링 시작
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        const interval = setInterval(() => {
          refreshRoomState(result.roomId);
        }, 1000);
        setPollingInterval(interval);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('방 생성 오류:', error);
      return false;
    }
  }, [playerId, pollingInterval, refreshRoomState]);

  // 방 참가
  const joinRoom = useCallback(async (roomId: string, asSpectator: boolean = false) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/room/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roomId, asSpectator })
      });
      
      const result = await response.json();
      if (result.success) {
        setCurrentRoom(result.roomState);
        setGameState('room');
        
        // 방 상태 폴링 시작
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        const interval = setInterval(() => {
          refreshRoomState(roomId);
        }, 1000);
        setPollingInterval(interval);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('방 참가 오류:', error);
      return false;
    }
  }, [playerId, pollingInterval, refreshRoomState]);

  // 방 나가기
  const leaveRoom = useCallback(async () => {
    if (!currentRoom) return;
    
    try {
      await fetch(`${SERVER_URL}/api/room/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roomId: currentRoom.id })
      });
      
      setCurrentRoom(null);
      setGameState('lobby');
      
      // 폴링을 로비 폴링으로 변경
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      const interval = setInterval(() => {
        refreshRooms();
        refreshLobbyChat();
      }, 2000);
      setPollingInterval(interval);
    } catch (error) {
      console.error('방 나가기 오류:', error);
    }
  }, [playerId, currentRoom, pollingInterval, refreshRooms, refreshLobbyChat]);

  // 게임 수 두기
  const makeMove = useCallback(async (row: number, col: number) => {
    if (!currentRoom) return false;
    
    try {
      const response = await fetch(`${SERVER_URL}/api/room/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roomId: currentRoom.id, row, col })
      });
      
      const result = await response.json();
      if (result.success) {
        // 즉시 방 상태 새로고침
        setTimeout(() => refreshRoomState(currentRoom.id), 100);
      }
      return result.success;
    } catch (error) {
      console.error('게임 수 두기 오류:', error);
      return false;
    }
  }, [playerId, currentRoom, refreshRoomState]);

  // 방 채팅 보내기
  const sendRoomChat = useCallback(async (message: string) => {
    if (!currentRoom) return;
    
    try {
      await fetch(`${SERVER_URL}/api/room/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, roomId: currentRoom.id, message })
      });
      // 즉시 방 상태 새로고침 (채팅 포함)
      setTimeout(() => refreshRoomState(currentRoom.id), 100);
    } catch (error) {
      console.error('방 채팅 오류:', error);
    }
  }, [playerId, currentRoom, refreshRoomState]);

  // 게임 리셋
  const resetGame = useCallback(async () => {
    if (!currentRoom) return;
    
    try {
      await fetch(`${SERVER_URL}/api/room/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: currentRoom.id })
      });
      // 즉시 방 상태 새로고침
      setTimeout(() => refreshRoomState(currentRoom.id), 100);
    } catch (error) {
      console.error('게임 리셋 오류:', error);
    }
  }, [currentRoom, refreshRoomState]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  return {
    // 상태
    playerId,
    playerName,
    gameState,
    rooms,
    currentRoom,
    lobbyChatHistory,
    isConnected,
    
    // 액션
    joinLobby,
    sendLobbyChat,
    createRoom,
    joinRoom,
    leaveRoom,
    makeMove,
    sendRoomChat,
    resetGame,
    refreshRooms,
    
    // 유틸리티
    setGameState
  };
};
