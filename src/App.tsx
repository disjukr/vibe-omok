import { useState, useEffect, useRef } from 'react'
import { css } from '../styled-system/css'
import { useGameClient } from './hooks/useGameClient'

const App = () => {
  const {
    playerId,
    playerName,
    gameState,
    rooms,
    currentRoom,
    lobbyChatHistory,
    isConnected,
    joinLobby,
    sendLobbyChat,
    createRoom,
    joinRoom,
    leaveRoom,
    makeMove,
    sendRoomChat,
    resetGame,
    refreshRooms
  } = useGameClient()

  const [nameInput, setNameInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [roomNameInput, setRoomNameInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lobbyChatHistory, currentRoom?.chatHistory])

  // 초기 방 목록 로드
  useEffect(() => {
    if (isConnected) {
      refreshRooms()
    }
  }, [isConnected, refreshRooms])

  // 사용자 이름 설정 화면
  const renderNameInput = () => (
    <div className={css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    })}>
      <div className={css({
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      })}>
        <h1 className={css({
          fontSize: '2.5rem',
          marginBottom: '10px',
          color: '#333'
        })}>
          온라인 오목
        </h1>
        <p className={css({
          marginBottom: '30px',
          color: '#666'
        })}>
          게임에 참가하려면 닉네임을 입력하세요
        </p>
        <div className={css({
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        })}>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="닉네임을 입력하세요"
            className={css({
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              flex: 1,
              '&:focus': {
                outline: 'none',
                borderColor: '#4CAF50'
              }
            })}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && nameInput.trim()) {
                joinLobby(nameInput.trim())
              }
            }}
          />
          <button
            onClick={() => nameInput.trim() && joinLobby(nameInput.trim())}
            disabled={!nameInput.trim()}
            className={css({
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#45a049'
              },
              '&:disabled': {
                backgroundColor: '#ccc',
                cursor: 'not-allowed'
              }
            })}
          >
            참가
          </button>
        </div>
      </div>
    </div>
  )

  // 로비 화면
  const renderLobby = () => (
    <div className={css({
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f5f5f5'
    })}>
      {/* 방 목록 */}
      <div className={css({
        flex: 2,
        padding: '20px',
        backgroundColor: 'white',
        borderRight: '1px solid #ddd'
      })}>
        <div className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        })}>
          <h2 className={css({ fontSize: '1.5rem', color: '#333' })}>
            게임 방 목록
          </h2>
          <div className={css({ display: 'flex', gap: '10px' })}>
            <input
              type="text"
              value={roomNameInput}
              onChange={(e) => setRoomNameInput(e.target.value)}
              placeholder="방 이름"
              className={css({
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              })}
            />
            <button
              onClick={() => {
                if (roomNameInput.trim()) {
                  createRoom(roomNameInput.trim())
                  setRoomNameInput('')
                }
              }}
              className={css({
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              })}
            >
              방 만들기
            </button>
            <button
              onClick={refreshRooms}
              className={css({
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              })}
            >
              새로고침
            </button>
          </div>
        </div>

        <div className={css({
          display: 'grid',
          gap: '10px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
        })}>
          {rooms.map((room) => (
            <div
              key={room.id}
              className={css({
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: '#f0f0f0'
                }
              })}
              onClick={() => joinRoom(room.id)}
            >
              <h3 className={css({ marginBottom: '5px', color: '#333' })}>
                {room.name}
              </h3>
              <p className={css({ fontSize: '0.9rem', color: '#666', marginBottom: '5px' })}>
                방장: {room.creator}
              </p>
              <div className={css({ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' })}>
                <span>플레이어: {room.playerCount}/2</span>
                <span>관전자: {room.spectatorCount}</span>
                <span className={css({
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: room.gameState === 'playing' ? '#4CAF50' : '#FFC107',
                  color: 'white'
                })}>
                  {room.gameState === 'playing' ? '게임중' : '대기중'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 로비 채팅 */}
      <div className={css({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
      })}>
        <div className={css({
          padding: '20px',
          borderBottom: '1px solid #ddd'
        })}>
          <h3 className={css({ color: '#333' })}>로비 채팅</h3>
          <p className={css({ fontSize: '0.9rem', color: '#666' })}>
            {playerName}님 환영합니다!
          </p>
        </div>

        <div className={css({
          flex: 1,
          padding: '10px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 200px)'
        })}>
          {lobbyChatHistory.map((msg) => (
            <div
              key={msg.id}
              className={css({
                marginBottom: '10px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: msg.playerId === playerId ? '#e3f2fd' : '#f5f5f5'
              })}
            >
              <div className={css({
                fontSize: '0.8rem',
                color: '#666',
                marginBottom: '2px'
              })}>
                {msg.playerName} • {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
              <div>{msg.message}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className={css({
          padding: '10px',
          borderTop: '1px solid #ddd',
          display: 'flex',
          gap: '10px'
        })}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className={css({
              flex: 1,
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            })}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && chatInput.trim()) {
                sendLobbyChat(chatInput.trim())
                setChatInput('')
              }
            }}
          />
          <button
            onClick={() => {
              if (chatInput.trim()) {
                sendLobbyChat(chatInput.trim())
                setChatInput('')
              }
            }}
            className={css({
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            })}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )

  // 방/게임 화면
  const renderRoom = () => {
    if (!currentRoom) return null

    const currentPlayer = currentRoom.players.find(p => p.id === playerId)
    const isMyTurn = currentPlayer && currentRoom.currentPlayer === currentPlayer.color
    const canPlay = currentPlayer?.role === 'player' && currentRoom.gameState === 'playing'

    return (
      <div className={css({
        display: 'flex',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      })}>
        {/* 게임 보드 */}
        <div className={css({
          flex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px'
        })}>
          <div className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '600px',
            marginBottom: '20px'
          })}>
            <button
              onClick={leaveRoom}
              className={css({
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              })}
            >
              방 나가기
            </button>

            <h2 className={css({ color: '#333' })}>
              {currentRoom.name}
            </h2>

            {currentRoom.gameState === 'finished' && (
              <button
                onClick={resetGame}
                className={css({
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                })}
              >
                새 게임
              </button>
            )}
          </div>

          <div className={css({
            marginBottom: '20px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: '#555'
          })}>
            {currentRoom.gameState === 'waiting' && '플레이어를 기다리는 중...'}
            {currentRoom.gameState === 'playing' && (
              <>
                현재 차례: {currentRoom.currentPlayer === 'black' ? '흑돌' : '백돌'}
                {isMyTurn && ' (당신의 차례)'}
              </>
            )}
            {currentRoom.gameState === 'finished' && (
              `게임 종료! 승자: ${currentRoom.winner === 'black' ? '흑돌' : '백돌'}`
            )}
          </div>

          <div className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(19, 25px)',
            gap: '1px',
            backgroundColor: '#8B4513',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          })}>
            {currentRoom.board && currentRoom.board.map((row, rowIndex) =>
              row && row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={css({
                    width: '25px',
                    height: '25px',
                    backgroundColor: '#DEB887',
                    border: '1px solid #8B4513',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canPlay && !cell ? 'pointer' : 'default',
                    '&:hover': {
                      backgroundColor: canPlay && !cell ? '#F4A460' : '#DEB887'
                    }
                  })}
                  onClick={() => {
                    if (canPlay && !cell && isMyTurn) {
                      makeMove(rowIndex, colIndex)
                    }
                  }}
                >
                  {cell && (
                    <div className={css({
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: cell === 'black' ? '#000' : '#fff',
                      border: cell === 'white' ? '2px solid #333' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    })} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 사이드바 (플레이어 목록 + 채팅) */}
        <div className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          borderLeft: '1px solid #ddd'
        })}>
          {/* 플레이어 목록 */}
          <div className={css({
            padding: '20px',
            borderBottom: '1px solid #ddd'
          })}>
            <h3 className={css({ marginBottom: '15px', color: '#333' })}>
              플레이어
            </h3>
            {currentRoom.players && currentRoom.players.map((player) => (
              <div
                key={player.id}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: player.id === playerId ? '#e3f2fd' : '#f5f5f5'
                })}
              >
                <div className={css({
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: player.color === 'black' ? '#000' : '#fff',
                  border: player.color === 'white' ? '2px solid #333' : 'none'
                })} />
                <span>{player.name}</span>
                {player.id === playerId && <span className={css({ fontSize: '0.8rem', color: '#666' })}>(나)</span>}
              </div>
            ))}

            {currentRoom.spectators && currentRoom.spectators.length > 0 && (
              <>
                <h4 className={css({ marginTop: '15px', marginBottom: '10px', color: '#666' })}>
                  관전자
                </h4>
                {currentRoom.spectators.map((spectator) => (
                  <div
                    key={spectator.id}
                    className={css({
                      padding: '4px 8px',
                      marginBottom: '4px',
                      borderRadius: '4px',
                      backgroundColor: spectator.id === playerId ? '#e3f2fd' : '#f9f9f9',
                      fontSize: '0.9rem'
                    })}
                  >
                    👁️ {spectator.name}
                    {spectator.id === playerId && ' (나)'}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 방 채팅 */}
          <div className={css({
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          })}>
            <div className={css({
              padding: '15px 20px',
              borderBottom: '1px solid #ddd'
            })}>
              <h3 className={css({ color: '#333' })}>채팅</h3>
            </div>

            <div className={css({
              flex: 1,
              padding: '10px',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 400px)'
            })}>
              {currentRoom.chatHistory && currentRoom.chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={css({
                    marginBottom: '10px',
                    padding: '8px',
                    borderRadius: '4px',
                    backgroundColor: msg.playerId === playerId ? '#e3f2fd' : '#f5f5f5'
                  })}
                >
                  <div className={css({
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '2px'
                  })}>
                    {msg.playerName} • {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <div>{msg.message}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className={css({
              padding: '10px',
              borderTop: '1px solid #ddd',
              display: 'flex',
              gap: '10px'
            })}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className={css({
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                })}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    sendRoomChat(chatInput.trim())
                    setChatInput('')
                  }
                }}
              />
              <button
                onClick={() => {
                  if (chatInput.trim()) {
                    sendRoomChat(chatInput.trim())
                    setChatInput('')
                  }
                }}
                className={css({
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                })}
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 메인 렌더링
  if (!playerName) {
    return renderNameInput()
  }

  if (gameState === 'lobby') {
    return renderLobby()
  }

  if (gameState === 'room' || gameState === 'game') {
    return renderRoom()
  }

  return null
}

export default App
