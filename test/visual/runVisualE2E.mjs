import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const distDir = path.join(rootDir, 'dist');
const screenshotsDir = path.join(__dirname, 'screenshots');
const artifactDir = process.env.ARTIFACT_DIR || '/root/.local/share/ai/agy/agyg/.gemini/antigravity-cli/brain/0325d17f-ece8-4d65-91f4-0fa2ea551c05';

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1. Build web bundle if needed
console.log('📦 Checking web bundle...');
if (!fs.existsSync(path.join(distDir, 'index.html')) || process.argv.includes('--rebuild')) {
  console.log('Building web bundle with expo export...');
  execSync('pnpm expo export -p web', { cwd: rootDir, stdio: 'inherit' });
}

// 2. MIME map for static server
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 8099;
const CDP_PORT = 9223;

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`🚀 Static server started at http://127.0.0.1:${PORT}`);

  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    'about:blank'
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('Could not find Chrome page target');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let reqId = 1;
    const pending = new Map();
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    const send = (method, params = {}) => {
      const id = reqId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await new Promise((r) => (ws.onopen = r));
    console.log('🔌 Connected to Headless Chrome via CDP');

    await send('Page.enable');
    await send('Runtime.enable');

    // Simulate iPhone 15 Mobile Viewport (390 x 844, 3x DPR, Touch Enabled)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      hasTouch: true,
    });

    await send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Web3Chat/1.0',
    });

    const SCENES = [
      {
        key: 'chats',
        hash: '#chats',
        fileName: '01_chats_list.png',
        title: '1. 会话列表 (Chats Screen)',
      },
      {
        key: 'chat_detail',
        hash: '#chat_detail',
        fileName: '02_chat_detail.png',
        title: '2. 聊天详情与红包卡片 (Chat Detail Screen)',
      },
      {
        key: 'red_packet_modal',
        hash: '#red_packet_modal',
        fileName: '03_red_packet_modal.png',
        title: '3. LuckyDrop 链上红包拆解弹窗 (Claim Result Modal)',
      },
      {
        key: 'contacts',
        hash: '#contacts',
        fileName: '04_contacts_list.png',
        title: '4. 通讯录好友分组列表 (Contacts Screen)',
      },
      {
        key: 'add_friend',
        hash: '#add_friend',
        fileName: '05_add_friend.png',
        title: '5. 添加朋友与地址搜索 (Add Friend Screen)',
      },
      {
        key: 'discover',
        hash: '#discover',
        fileName: '06_discover.png',
        title: '6. 发现页面 Web3 DApp 目录 (Discover Screen)',
      },
      {
        key: 'sign_sheet',
        hash: '#sign_sheet',
        fileName: '07_sign_approval_sheet.png',
        title: '7. DApp 浏览器签名授权抽屉 (Sign Approval Sheet)',
      },
      {
        key: 'me',
        hash: '#me',
        fileName: '08_me_assets.png',
        title: '8. “我”个人中心与多链资产总览 (Me Screen)',
      },
      {
        key: 'chain_switch',
        hash: '#chain_switch',
        fileName: '09_chain_switch_modal.png',
        title: '9. 切换区块链网络弹窗 (Chain Switch Modal)',
      },
    ];

    console.log(`\n📸 Starting Visual E2E Screenshot Run (${SCENES.length} mobile scenes)...\n`);

    for (const scene of SCENES) {
      console.log(`▶ Navigating to [${scene.title}] via ${scene.hash}...`);
      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${scene.hash}` });

      // Wait for layout and animation stabilization
      await new Promise((r) => setTimeout(r, 600));

      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(screenshot.data, 'base64');

      const outPath = path.join(screenshotsDir, scene.fileName);
      fs.writeFileSync(outPath, buffer);

      if (fs.existsSync(artifactDir)) {
        const artifactPath = path.join(artifactDir, scene.fileName);
        fs.writeFileSync(artifactPath, buffer);
      }

      console.log(`  ✓ Captured ${scene.fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
    }

    console.log(`\n🎉 All ${SCENES.length} mobile screenshots captured successfully!`);
    ws.close();
  } catch (err) {
    console.error('❌ Visual E2E Run failed:', err);
    process.exitCode = 1;
  } finally {
    chrome.kill();
    server.close();
  }
});
