# Render 배포 가이드

## 1. GitHub에 코드 올리기

이 폴더에서 (이미 `git push` 했다면 생략):

```bash
git remote -v   # origin 확인
git push -u origin main
```

## 2. Render 연결

1. https://dashboard.render.com 로그인
2. **New +** → **Blueprint**
3. GitHub 계정 연결 후 **skull_king** 저장소 선택
4. `render.yaml` 인식 → **Apply**
5. 배포 로그에서 **Live** 될 때까지 대기 (약 3~5분)

## 3. 주소 확인

- Render 대시보드 → 서비스 **skull-king** → 상단 URL  
  예: `https://skull-king.onrender.com`
- 이 주소를 친구에게내면 **온라인 방 만들기** 가능

## 문제 해결

| 증상 | 해결 |
|------|------|
| 첫 접속이 매우 느림 | 무료 플랜 슬립 — 30초 후 새로고침 |
| Build failed | Node 18+ 확인, `npm install` 로컬에서 테스트 |
| WebSocket 끊김 | Render 무료는 유휴 시 종료 — 다시 접속 |
