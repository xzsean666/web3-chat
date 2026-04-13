# Web3 Chat

一个前端 + 轻量后端、移动端优先的 Web3 钱包聊天项目。

## 已实现

- 使用 EVM 钱包签名作为身份。
- 私聊 / 群聊都基于 WebRTC Data Channel。
- 后端负责身份、好友关系、群组和 WebRTC 信令，聊天内容仍走浏览器之间的 P2P 数据通道。
- UI 基于 Vue 3 + PrimeVue，PC 端也固定为移动端视图。
- 同时支持 TURN 和 STUN。
- TURN 凭据由后端 `/api/turn-credentials` 动态下发。
- 邀请链接带有效期。
- 钱包签名、房间口令、邀请链接、消息历史只保存在 `sessionStorage`。
- `localStorage` 只保留非敏感的房间索引，用于恢复最近列表。
- 每条消息附带会话临时密钥签名，接收方使用握手期间验证过的公钥校验。
- 握手改为房间级 challenge-response，避免直接复用可重放的钱包 proof。

## 当前技术栈

- Vue `3.5.32`
- Vite `8.0.8`
- Pinia `3.0.4`
- PrimeVue `4.5.5`
- PrimeIcons `7.0.0`
- PrimeUIX Themes `2.0.3`
- viem `2.47.12`
- trystero `0.23.0`

## 本地启动

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm dev
```

默认开发地址通常是 `http://localhost:5173`。

## 关键环境变量

```env
VITE_BACKEND_BASE_URL=https://your-backend.example.com
VITE_BACKEND_WS_URL=wss://your-backend.example.com/ws
VITE_STUN_SERVERS=stun:YOUR_PUBLIC_IP:3478,stun:stun.cloudflare.com:3478
VITE_ENABLE_TEST_IDENTITY=false
ALLOWED_ORIGINS=https://your-frontend.example.com,http://localhost:5173,http://127.0.0.1:5173
TURN_SECRET=change-me
TURN_TTL_SECONDS=3600
TURN_REALM=YOUR_PUBLIC_IP
TURN_EXTERNAL_IP=YOUR_PUBLIC_IP/YOUR_PRIVATE_IP
TURN_PORT=3478
TURN_MIN_PORT=49160
TURN_MAX_PORT=49200
STUN_URLS=stun:YOUR_PUBLIC_IP:3478
TURN_URLS=turn:YOUR_PUBLIC_IP:3478?transport=udp,turn:YOUR_PUBLIC_IP:3478?transport=tcp
VITE_HANDSHAKE_TTL_MS=86400000
VITE_ROOM_HISTORY_LIMIT=200
VITE_MAX_MESSAGE_LENGTH=1000
VITE_MESSAGE_FRESHNESS_MS=600000
```

说明：

- `VITE_BACKEND_BASE_URL` 和 `VITE_BACKEND_WS_URL` 必须指向你的对外可访问后端或反向代理地址。
- `STUN_URLS` 和 `TURN_URLS` 对外填写的始终应该是公网地址。
- `TURN_EXTERNAL_IP` 是 coturn 最容易填错的字段。
- 单公网 IP 主机可以写成 `TURN_EXTERNAL_IP=YOUR_PUBLIC_IP`。
- 阿里云 / 腾讯云 / EIP / NAT 这类公网 IP 和内网 IP 分离的场景，应该写成 `TURN_EXTERNAL_IP=YOUR_PUBLIC_IP/YOUR_PRIVATE_IP`。
- 如果这里写错，页面可能能登录、能加好友、能拿到 relay candidate，但真实 TURN 中继会卡在“正在建立 P2P 通道”。
- `localhost / 127.0.0.1 / ::1` 默认会显示“测试身份”按钮；非本地环境如需启用，请设置 `VITE_ENABLE_TEST_IDENTITY=true`。

## 生产构建

```bash
pnpm build
pnpm preview
```

## 测试

```bash
pnpm test
```

## 当前架构边界

- 项目包含一个轻量后端，但聊天内容本身不入库。
- 真正的聊天消息通过浏览器之间的 P2P 数据通道传输，不经过你的业务后端。
- 群聊仍然是 mesh 结构，适合小规模房间。
- 浏览器 `localStorage` 中仍会留下房间索引元数据；如果你需要更高安全等级，仍应评估本地加密和设备安全。

## 目录

```text
.
├── AGENT.md
├── Agent.md
├── build_progress.md
├── docs
│   ├── architecture.md
│   └── security.md
├── infra
│   ├── relay-docker
│   └── stun-docker
└── src
```

## 文档

- [架构说明](./docs/architecture.md)
- [安全说明](./docs/security.md)
- [TURN / STUN Docker 部署](./infra/stun-docker/README.md)
- [Relay Docker 部署](./infra/relay-docker/README.md)
- [AI 协作文档](./AGENT.md)
- [构建进度](./build_progress.md)
