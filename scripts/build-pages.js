const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'skull_king_kraken_whale_fixed.html');
const docsDir = path.join(root, 'docs');

fs.mkdirSync(docsDir, { recursive: true });
fs.copyFileSync(src, path.join(docsDir, 'index.html'));
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

const configPath = path.join(docsDir, 'config.js');
const configDefault = `// 온라인(WebSocket) 서버를 Render 등에 배포한 뒤 아래 주석을 해제하세요.
// window.SKULL_KING_WS = 'wss://your-app.onrender.com';
`;
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, configDefault);
}

console.log('docs/index.html ready for GitHub Pages');
