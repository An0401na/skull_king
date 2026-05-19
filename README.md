# Skull King

해적 테마 트릭 테이킹 카드 게임. **로컬** + **온라인(방 코드)** 지원.

## 배포 (GitHub 없이) — 추천

게임 화면과 온라인 서버가 **한 번에** 올라가는 방식입니다. `npm start` 하나로 HTML + WebSocket 모두 동작합니다.

### 1) Render.com (무료, 가장 간단)

1. [render.com](https://render.com) 가입 → **New → Blueprint**
2. 이 프로젝트 Git 저장소 연결 (GitHub/GitLab 어디든 OK)
3. `render.yaml` 이 보이면 **Apply** → 배포 완료까지 2~5분
4. 주소 예: `https://skull-king-xxxx.onrender.com` → 친구에게 이 URL 공유

친구는 그 주소만 열면 **로컬·온라인 모두** 사용 가능합니다. (별도 config 불필요)

> 무료 플랜은 15분 미사용 시 잠들 수 있어, 첫 접속이 30초 정도 느릴 수 있습니다.

### 2) Railway / Fly.io

저장소 연결 후:

- **Build:** `npm install`
- **Start:** `npm start`
- **PORT:** 호스트가 자동으로 넣어 줌 (`process.env.PORT` 사용 중)

### 3) 내 PC·집 서버 (공유기 뒤)

```bash
npm install
npm start
```

- 같은 Wi‑Fi: `http://<내 PC IP>:3000`
- 인터넷에서 접속: 공유기 **포트 포워딩** 3000 → PC, 또는 ngrok:

```bash
npx ngrok http 3000
```

ngrok이 준 `https://xxxx.ngrok-free.app` 주소를 친구에게 전달.

### 4) VPS (AWS, 카페24, Oracle 무료 등)

```bash
git clone <저장소 URL>
cd skull_king
npm install
PORT=3000 npm start
```

상시 실행은 **pm2** 권장:

```bash
npm install -g pm2
pm2 start server.js --name skull-king
pm2 save
```

방화벽에서 `PORT` 개방, 도메인 연결은 선택.

---

## GitHub Pages (화면만, 온라인 X)

1. GitHub에 저장소 생성 (예: `skull_king`)
2. 이 폴더를 push:

```bash
git init
git add .
git commit -m "Add Skull King game and GitHub Pages deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/skull_king.git
git push -u origin main
```

3. 저장소 **Settings → Pages → Build and deployment**  
   - Source: **GitHub Actions** (workflow가 `docs`를 자동 배포)

4. 1~2분 후 접속:  
   `https://YOUR_USERNAME.github.io/skull_king/`

> GitHub Pages는 정적 파일만 호스팅합니다. **로컬 플레이**는 위 주소에서 그대로 됩니다.

## 로컬에서 개발/플레이 (PC)

```bash
npm install
npm start
```

브라우저: **http://localhost:3000** — 로컬 + 온라인 모두 사용 가능.

## 온라인 서버 (선택)

GitHub Pages만으로는 WebSocket 서버를 돌릴 수 없습니다. 온라인을 쓰려면 [Render](https://render.com) 등에 `server.js`를 배포한 뒤, `docs/config.js`에 주소를 넣으세요:

```javascript
window.SKULL_KING_WS = 'wss://your-app.onrender.com';
```

다시 push하면 Pages에서도 온라인 탭이 활성화됩니다.

## 수동으로 Pages 빌드

```bash
npm run build:pages
```

`docs/index.html` 이 생성됩니다.
