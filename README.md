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
VITE_TURN_URLS=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
VITE_PREFER_TURN=false
VITE_TURN_ONLY_TIMEOUT_MS=6000
VITE_INVITE_TTL_MS=43200000
```

说明：

- 不配置 TURN 时，应用只会走 STUN。
- 配置 TURN 后，前端会先尝试 `relay` 路径，再自动回退到混合模式。
- 是否最终选中 TURN / STUN，也仍然受浏览器 ICE 行为和实际网络环境影响。
- `VITE_TURN_URLS` 为空是默认安全起步，避免示例假地址导致首次连接必然超时。

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
│   └── stun-docker
└── src
```

## 文档

- [架构说明](./docs/architecture.md)
- [安全说明](./docs/security.md)
- [TURN / STUN Docker 部署](./infra/stun-docker/README.md)
- [AI 协作文档](./AGENT.md)
- [构建进度](./build_progress.md)
