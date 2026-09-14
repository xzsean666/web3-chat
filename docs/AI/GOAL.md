# Project Goal: Web3 Chat Mobile App

## 1. Product Vision (产品愿景)
打造一个具备类似微信操作体验的 Web3 去中心化社交移动端 App。
基于 React Native + Expo (TypeScript)，深度复用既有基础设施生态，实现主权身份、链上社交关系、离线优先私密通信、去中心化红包以及原生 Web3 钱包/DApp 浏览器的一体化体验。

## 2. 目标网络 (Target Networks)
- **MVP 指定默认网络**: BSC Testnet (Chain ID: 97)
  - Currency: tBNB
  - RPC: 高可用公共/私有 RPC 节点
- **多链扩展架构**: 支持在 EVM 兼容链之间快速切换（如 Ethereum, Base, Polygon, Arbitrum 等）。

## 3. 核心功能范围 (In-Scope for MVP)

### 3.1 微信风格四标签页导航 (4-Tab WeChat-Style Shell)
1. **Chat (聊天)**
   - 采用 Local-First + Periodic Sync（周期性拉取同步）机制。
   - 对接 `/ssd0/git/web3-chat-worker` 的 `/sync`、`/messages` 接口。
   - 支持 1:1 私聊（确定性 ID `dm:minAddress:maxAddress`）与群聊。
   - 支持纯文本消息、发送状态 ACK、已读 ACK 与 30s 消息撤回。
   - 支持 LuckyDrop Token 红包卡片展示与即时领取唤起。
2. **Contacts (通讯录)**
   - 对接 `/ssd0/git/web3-chat-contract` 上的 `ChatStorageFactory` 与 `RelationshipManager`。
   - 展示链上已确认好友列表、好友申请通知、群组列表。
   - 支持好友备注与自定义标签存储。
3. **Discover (发现 / DApp 浏览器)**
   - 类似 MetaMask 内置 DApp 浏览器。
   - 提供内置离线主页（常用 Web3 导航与 DApp 推荐）。
   - 注入标准 EIP-1193 Provider，支持外部 DApp 唤起钱包连接、签名请求与链上交易。
4. **Me (我 / 资产与设置)**
   - 用户基础个人资料展示（地址、ENS/名片、头像）。
   - 钱包总览与资产估值。
   - 资产明细 Holdings Breakdown（通过 `evm-call` 批量 Multicall 查询 ERC-20 余额）。
   - 网络切换 (Chain Switch) 与安全设置。

### 3.2 钱包内核 (Wallet Core)
- 类似 MetaMask 的独立钱包体验：
  - 支持助记词生成 (BIP-39) / 私钥创建与导入。
  - 本地安全存储（Secure Store / 加密持久化）。
  - EIP-191 个人签名、EIP-712 类型化签名与交易签名。
  - 原生币与 ERC-20 余额实时查询。

### 3.3 Token 红包 (Token Red Packet)
- 对接 `/ssd0/git/LuckyDrop` 智能合约与 `@luckydrop/sdk`：
  - 支持发 1:1 红包与群红包（固定金额/随机金额）。
  - 基于 Merkle Tree 链下构建与链上常数级 $O(1)$ 资金锁定。
  - 在聊天流中展示专属红包卡片，支持一键 Claim 领取。

### 3.4 底层 RPC 交互
- **所有 EVM 链上交互统一使用 `/ssd0/git/evm-call`**：
  - 节点池负载均衡、阶梯式故障避退、Multicall3 批量代币查询、确定性事件日志。

## 4. 明确排除范围 (Out-of-Scope for MVP)
- ❌ 传统高频 WebRTC 实时语音与实时视频通话。
- ❌ 非 EVM 公链（如 Solana, Cosmos, Bitcoin 原生）。
- ❌ 聊天界面内置复杂 DEX 交易聚合器（用户可通过 Discover 访问外部 Uniswap/PancakeSwap）。
- ❌ 生产主网真金白银资产托管。

## 5. 验收标准 (Acceptance Criteria)
- [ ] Expo React Native TypeScript 项目在 Node.js 24 + pnpm 环境下无类型错误与构建阻塞。
- [ ] 微信四 Tab 基础界面流畅切换与操作动效符合预期。
- [ ] 钱包模块支持本地安全创建/导入与离线签名。
- [ ] Chat 模块实现与 `web3-chat-worker` 的本地优先持久化与周期同步。
- [ ] Contacts 模块成功读取 `web3-chat-contract` 上的链上社交好友与群组数据。
- [ ] Red Packet 模块可成功构造并在 BSC Testnet 上认领 LuckyDrop 红包。
- [ ] Discover 模块成功加载离线主页与测试 DApp，并支持 EIP-1193 签名授权。
