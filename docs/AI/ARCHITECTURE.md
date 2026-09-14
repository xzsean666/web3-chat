# Architecture Specification: Web3 Chat Mobile App

## 1. System Topology (系统拓扑)

```text
                               +--------------------------------------------------+
                               |                 web3-chat App                    |
                               |          (React Native + Expo + TS)              |
                               +--------------------------------------------------+
                               |  [Tab 1]   |   [Tab 2]    |  [Tab 3]   | [Tab 4] |
                               |   Chat     |  Contacts    | Discover   |   Me    |
                               +------------+--------------+------------+---------+
                               |  Local-First DB  |  Secure KeyStore (BIP-39/PK)  |
                               +------------------+-------------------------------+
                                      |            |               |
               REST / Sync            |            |               | Web3 RPC / Multicall
         (Auth, Msg, Ack, Sync)       |            |               | (Balances, Calls)
                                      v            |               v
                        +----------------------+   |   +-----------------------+
                        |   web3-chat-worker   |   |   |       evm-call        |
                        | (Cloudflare Worker)  |   |   | (RPC Pool / Failover) |
                        +----------------------+   |   +-----------------------+
                                |                  |               |
                    D1 / R2 / Push                 |               |
                                                   v               v
                                       +---------------------------------------+
                                       |       BSC Testnet (EVM Chain)         |
                                       |---------------------------------------|
                                       |  1. web3-chat-contract (Social State) |
                                       |  2. LuckyDrop (Token Red Packet)      |
                                       |  3. Standard ERC-20 / Native Assets   |
                                       +---------------------------------------+
```

## 2. 核心架构分层 (Layered Architecture)

```text
src/
├── app/                    # 路由与入口导航 (Expo Router / React Navigation)
│   ├── (tabs)/             # 4 个微信主 Tab: chat, contacts, discover, me
│   ├── wallet/             # 钱包创建、导入、密码解锁流程
│   ├── chat/               # 对话详情页、群聊详情、消息撤回/已读
│   ├── packet/             # 发红包、抢红包、红包明细弹窗
│   └── browser/            # DApp 浏览器全屏容器与 Web3 授权弹窗
├── components/             # 公共基础 UI 组件 (WeChat 风格基础组件库)
├── features/               # 按业务域垂直切分的业务逻辑与 Hook
│   ├── wallet/             # 钱包密钥派生、签名器、助记词导入导出
│   ├── chat/               # 本地优先消息流转、会话计算、Periodic Sync
│   ├── contacts/           # 链上好友请求、双向确认、群组发现
│   ├── packet/             # LuckyDrop Merkle 红包生成与领取逻辑
│   ├── discover/           # DApp 推荐列表、EIP-1193 Provider 桥接脚本
│   └── assets/             # 多链资产解析、ERC-20 列表与 Multicall3 查询
├── services/               # 外部基础设施集成服务
│   ├── evm/                # 基于 evm-call 的多链客户端封装与 RPC Pool
│   ├── worker/             # 对接 web3-chat-worker 的 HTTP 客户端与 SIWE 鉴权
│   ├── contracts/          # 对接 web3-chat-contract 的社交状态封装
│   ├── luckydrop/          # 对接 LuckyDrop 合约与 SDK 的红包服务
│   └── storage/            # Local-First SQLite 存储与 SecureStore 封装
├── types/                  # 全局领域模型与 TypeScript 类型定义
└── constants/              # 链配置 (BSC Testnet 等)、合约地址、默认主题
```

## 3. 关键子系统机制 (Key Mechanisms)

### 3.1 离线优先与周期性同步 (Local-First + Periodic Sync)
1. **本地优先写入**:
   - 用户发送文本消息时，客户端立即生成 UUID，本地写入 SQLite，标记为 `pending`，UI 瞬间上屏。
2. **异步队列上链/上报**:
   - 后台 Worker 客户端将消息投递至 `web3-chat-worker`（`POST /messages`）。
   - 收到 201 成功响应后，本地更新为 `sent`（仅代表服务器已收录，不代表对方已读）。
3. **周期性增量拉取**:
   - 采用低频轮询（如前台 5~10 秒，后台依靠通知或唤醒时刷新）：`GET /sync?since=<lastSyncTimestamp>`。
   - 批量获取新消息、送达 ACK、已读 ACK 与 30 秒撤回状态，合并至本地 SQLite。
4. **阅后即焚与 30s 撤回处理**:
   - 当接收方标记已读或发送方撤回消息，本地数据库同步执行打标与物理/遮盖擦除。

### 3.2 链上社交关系与反向索引 (Contacts Integration)
- 用户的个人 Profile、已确认的好友列表、创建/加入的群组由 `web3-chat-contract` 的 `ChatStorageFactory` 维护。
- App 使用 `evm-call` 或 `@web3-chat/sdk` 进行合约查询，并缓存在本地存储中，保证在弱网环境下通讯录依然秒开。

### 3.3 LuckyDrop 红包流转 (Red Packet Flow)
1. **发红包**:
   - 发起人输入总金额与份数，由客户端调用 `@luckydrop/sdk` 生成 Merkle Tree。
   - 发起人调用 ERC-20 `approve` 并在 LuckyDrop 代理合约上执行 `createPacket(merkleRoot)`。
   - 交易确认后，客户端将红包元数据（packetId, tokenAddress, totalAmount, totalShares, merkleRoot, proofs）打包为特殊消息类型发送到对应会话。
2. **抢红包**:
   - 接收方点击红包消息卡片，客户端从消息 payload 中提取本人的 Merkle Proof。
   - 调用 LuckyDrop 合约的 `claim(packetId, index, proof)` 提取代币。
   - 本地与链上更新 Bitmap 已领状态，展示领取动画与明细。

### 3.4 Discover DApp 浏览器与 EIP-1193 Bridge
- 在 React Native WebView 中注入 JavaScript 脚本，挂载 `window.ethereum` 对象。
- 当 DApp 发起 `eth_requestAccounts`、`personal_sign`、`eth_sendTransaction` 等方法时，WebView 向 React Native 原生环境发送 postMessage。
- 原生弹出确认授权弹窗（展示签名信息、交易详情、预估 Gas）。
- 用户确认后，由本地钱包私钥签名，并通过 `evm-call` 广播上链并返回结果给 DApp。

### 3.5 统一 EVM 基础设施 (`evm-call`)
- 严格遵循单一 EVM 客户端接入点原则，杜绝引入额外重量级 RPC 库。
- BSC Testnet 配置多节点自动切换与故障降级。
- 批量余额查询全部由 Multicall3 执行，单次网络请求获取全量 ERC-20 资产。
