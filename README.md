# Web3 Chat

一个纯前端、移动端优先的 Web3 钱包聊天项目。

## 已实现

- 使用 EVM 钱包签名作为身份。
- 私聊 / 群聊都基于 WebRTC Data Channel。
- 不使用自建业务后端。
- UI 基于 Vue 3 + PrimeVue，PC 端也固定为移动端视图。
- 同时支持 TURN 和 STUN。
- 如果配置了 TURN，前端会先尝试 relay-only，失败后再回退到 TURN + STUN 混合候选。
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
pnpm install
pnpm dev
```

默认开发地址通常是 `http://localhost:5173`。

## 关键环境变量

```env
VITE_STUN_SERVERS=stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302
VITE_RELAY_URLS=
VITE_SELF_HOSTED_RELAY_URLS=
VITE_ENABLE_AUTO_HOST_RELAY=true
VITE_AUTO_HOST_RELAY_PORT=7777
VITE_RELAY_PROBE_TIMEOUT_MS=6000
VITE_ACTIVE_RELAY_COUNT=4
VITE_TURN_URLS=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
VITE_PREFER_TURN=false
VITE_ENABLE_TEST_IDENTITY=false
VITE_TURN_ONLY_TIMEOUT_MS=6000
VITE_INVITE_TTL_MS=43200000
```

说明：

- `VITE_RELAY_URLS` 是公共信令 relay 列表，不是 TURN / STUN。你如果只部署了 coturn，还不算配置了这里的 relay。
- `VITE_SELF_HOSTED_RELAY_URLS` 用来显式填写你自己的 relay，例如 `ws://192.168.31.19:7777` 或 `wss://relay.example.com`。
- `VITE_ENABLE_AUTO_HOST_RELAY=true` 时，如果页面本身跑在明文 HTTP 上，前端会自动先尝试 `ws://当前页面主机:7777`，很适合中国网络下的局域网 / 轻量部署。
- 前端会先探测自建 relay，再探测公共 relay；探测不再只看 WebSocket 是否能打开，而是会做一次真实 Nostr 信令回环。`VITE_RELAY_PROBE_TIMEOUT_MS` 控制单个 relay 的探测超时，`VITE_ACTIVE_RELAY_COUNT` 控制实际优先使用多少条已探测可用的 relay。
- 不配置 TURN 时，应用只会走 STUN。
- 配置 TURN 后，前端会先尝试 `relay` 路径，再自动回退到混合模式。
- 是否最终选中 TURN / STUN，也仍然受浏览器 ICE 行为和实际网络环境影响。
- `VITE_TURN_URLS` 为空是默认安全起步，避免示例假地址导致首次连接必然超时。
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

- 这是纯前端实现，没有业务后端。
- WebRTC 初始发现仍依赖外部 relay 基础设施。
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
