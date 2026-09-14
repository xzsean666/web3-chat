# Task Index: Web3 Chat Mobile App

## 1. 任务流转规则
- 状态：`TODO -> IN_PROGRESS -> REVIEW -> DONE` （或 `BLOCKED`）
- 一次只推进一个 Task，严格按照依赖顺序执行。

---

## 2. 任务总览 (Master Task List)

| Task ID | Title | Status | Dependencies | Target Scope / Outputs |
|---|---|---|---|---|
| [TASK-001](tasks/TASK-001.md) | Initialize Expo React Native TypeScript Scaffolding & Base Tooling | DONE | None | Expo React Native TS 项目骨架、依赖安装、构建与测试配置 |
| [TASK-002](tasks/TASK-002.md) | Common Domain Types & Data Models | DONE | TASK-001 | 全局数据模型 (Chat, Message, Wallet, Packet, Contact) |
| [TASK-003](tasks/TASK-003.md) | BSC Testnet & Multi-Chain evm-call Integration Service | DONE | TASK-001, TASK-002 | 基于 evm-call 的多链与 BSC Testnet 客户端基座 |
| [TASK-004](tasks/TASK-004.md) | Local Secure KeyStore & Wallet Core Service | DONE | TASK-001, TASK-002 | BIP-39 助记词生成/导入、私钥本地安全存储、EIP-191 离线签名 |
| [TASK-005](tasks/TASK-005.md) | Local-First Storage Engine | DONE | TASK-001, TASK-002 | 离线优先持久化存储引擎 (会话、消息、已读焚毁与游标) |
| [TASK-006](tasks/TASK-006.md) | Web3 Chat Worker Client & SIWE Authentication Service | DONE | TASK-001, TASK-002, TASK-004 | 对接 web3-chat-worker：EIP-191 SIWE 认证、消息上报与增量拉取 |
| [TASK-007](tasks/TASK-007.md) | WeChat-Style 4-Tab Navigation & Shell UI | DONE | TASK-001, TASK-002 | 微信风格 4-Tab (Chat, Contacts, Discover, Me) 基础外壳与主题 |
| [TASK-008](tasks/TASK-008.md) | Chat Core Engine & Periodic Sync Service | DONE | TASK-005, TASK-006 | 离线消息队列、状态流转、周期性轮询与 30s 撤回协调器 |
| [TASK-009](tasks/TASK-009.md) | Chat UI Components & 1:1 / Group Conversation Screen | DONE | TASK-007, TASK-008 | 微信风格会话列表、气泡流、输入栏与长按气泡操作菜单 |
| [TASK-010](tasks/TASK-010.md) | Contacts Service & Screen (web3-chat-contract Integration) | DONE | TASK-003, TASK-007 | 对接 web3-chat-contract：链上好友关系、群组列表与通讯录界面 |
| [TASK-011](tasks/TASK-011.md) | LuckyDrop Red Packet Integration Service & Chat Card Component | DONE | TASK-003, TASK-004, TASK-009 | 对接 LuckyDrop：Merkle 红包构建、发红包弹窗、聊天红包卡片与 Claim |
| [TASK-012](tasks/TASK-012.md) | Me Screen & Asset Holdings Breakdown | DONE | TASK-003, TASK-004, TASK-007 | “我”页面：Multicall3 批量代币资产解析、网络切换面板与个人设置 |
| [TASK-013](tasks/TASK-013.md) | Discover Screen & DApp Browser WebView with EIP-1193 Bridge | DONE | TASK-003, TASK-004, TASK-007 | “发现”页面：内置离线主页、WebView DApp 浏览器与 EIP-1193 桥接弹窗 |
| [TASK-014](tasks/TASK-014.md) | Local Joint E2E Testing & Verification Suite | DONE | TASK-001 ~ TASK-013 | 全链路联合集成测试与综合验证交付报告 |
| [TASK-015](tasks/TASK-015.md) | Comprehensive Security & Performance Hardening & Audit | DONE | TASK-001 ~ TASK-014 | 全面安全审计与加固、存储与渲染性能优化、回归测试与审计报告 |
| [TASK-016](tasks/TASK-016.md) | Local Visual E2E & Mobile Emulation Screenshot Suite | DONE | TASK-001 ~ TASK-015 | 本地无头 Chrome 移动端视口模拟、全场景高保真界面走查与截图套件 |
| [TASK-017](tasks/TASK-017.md) | Modern Web3 & WeChat Design System UI/UX Polish | DONE | TASK-001 ~ TASK-016 | 全面现代 Web3 + 微信原生视觉规范与 UI/UX 美化重构，矢量图标系统集成与全场景质感升级 |
