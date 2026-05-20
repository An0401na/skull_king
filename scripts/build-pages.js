const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'skull_king_kraken_whale_fixed.html');
const docsDir = path.join(root, 'docs');

if (!fs.existsSync(src)) {
  console.error('Missing source HTML:', src);
  process.exit(1);
}

fs.mkdirSync(docsDir, { recursive: true });
fs.copyFileSync(src, path.join(docsDir, 'index.html'));
fs.copyFileSync(path.join(root, 'trick-rules.js'), path.join(docsDir, 'trick-rules.js'));
fs.copyFileSync(path.join(root, 'ai-player.js'), path.join(docsDir, 'ai-player.js'));
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

const ws =
  process.env.SKULL_KING_WS ||
  'wss://skull-king-hy5s.onrender.com';

const configPath = path.join(docsDir, 'config.js');
const isCi = !!process.env.GITHUB_ACTIONS;
const configBody = isCi
  ? `// GitHub Actions build — Render WebSocket\nwindow.SKULL_KING_WS = '${ws}';\n`
  : `// 로컬: npm start 사용 시 비워 두세요.\n// GitHub Pages 수동 빌드 시 아래 주석 해제:\n// window.SKULL_KING_WS = '${ws}';\n`;

fs.writeFileSync(configPath, configBody);

console.log('docs/index.html ready');
if (isCi) console.log('config.js →', ws);
