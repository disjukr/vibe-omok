#!/bin/bash

SERVER_URL="http://127.0.0.1:8787"

echo "=== API 테스트 시작 ==="

echo "1. 로비 참가 테스트"
curl -X POST $SERVER_URL/api/lobby/join \
  -H "Content-Type: application/json" \
  -d '{"playerId":"test123","playerName":"TestPlayer"}' \
  -w "\nStatus: %{http_code}\n\n"

echo "2. 로비 채팅 테스트"
curl -X POST $SERVER_URL/api/lobby/chat \
  -H "Content-Type: application/json" \
  -d '{"playerId":"test123","message":"안녕하세요!"}' \
  -w "\nStatus: %{http_code}\n\n"

echo "3. 채팅 히스토리 테스트"
curl -X GET $SERVER_URL/api/lobby/chat-history \
  -w "\nStatus: %{http_code}\n\n"

echo "4. 방 목록 테스트"
curl -X GET $SERVER_URL/api/rooms \
  -w "\nStatus: %{http_code}\n\n"

echo "5. 방 생성 테스트"
curl -X POST $SERVER_URL/api/room/create \
  -H "Content-Type: application/json" \
  -d '{"playerId":"test123","roomName":"테스트방","playerName":"TestPlayer"}' \
  -w "\nStatus: %{http_code}\n\n"

echo "=== 테스트 완료 ==="
