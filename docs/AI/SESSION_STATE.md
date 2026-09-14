# Session State Snapshot (当前状态快照)

- **当前 Goal**: 构建类似微信体验的 Web3 社交移动 App (React Native + Expo + TypeScript)，MVP 默认支持 BSC Testnet，无缝对接现有周边基础设施。
- **当前 Task**: TASK-016 (Local Visual E2E & Mobile Emulation Screenshot Suite)
- **当前状态**: DONE (所有 16 个任务全部完工交付，新增移动端视口 Visual E2E 自动化测试与全套高保真截图产出)
- **全项目已完成任务矩阵**:
  1. `TASK-001`: Expo 52 + React Native + TypeScript 工程脚手架及 Vitest 单元测试运行器搭建（DONE）。
  2. `TASK-002`: 全局核心业务领域类型系统 (`chat`, `contact`, `packet`, `wallet`, `index`)（DONE）。
  3. `TASK-003`: 基于 `evm-call` 的 BSC Testnet (Chain ID 97) 多链交互服务 `EvmService` 与备选 RPC 故障自动转移（DONE）。
  4. `TASK-004`: 基于 BIP-39 / Viem 的本地安全密钥管理 `KeyStoreService` 与钱包核心 `WalletCoreService`，支持助记词/私钥导入与 EIP-191 签名（DONE）。
  5. `TASK-005`: Local-First 离线优先持久化存储引擎 `StorageEngine`，包含会话表、消息表、未读计数及增量拉取时间戳游标（DONE）。
  6. `TASK-006`: 对接 `web3-chat-worker` 的 EIP-191 SIWE 认证服务 `AuthService` 与 API 客户端 `WorkerApiClient`，支持 7 天 Bearer Token 鉴权（DONE）。
  7. `TASK-007`: 微信经典绿色调视觉主题 (`#07C160`)、Badge 红点角标、HeaderBar、TabNavigator、RootNavigator 4-Tab 路由骨架（DONE）。
  8. `TASK-008`: 离线优先消息调度引擎 `ChatEngineService` 与周期同步协调器 `PeriodicSyncService`，支持离线 pending 暂存、恢复重传、ACK 回执与 30s 撤回（DONE）。
  9. `TASK-009`: 聊天会话列表与对话流界面 (`MessageBubble`, `ChatInputBar`, `ConversationListScreen`, `ChatDetailScreen`)，支持 30s 撤回倒计时与红包卡片（DONE）。
  10. `TASK-010`: 对接 `web3-chat-contract` 的链上社交发现服务 `SocialContractService`、`ContactsScreen`、`AddFriendScreen`，支持 A-Z 拼音/字母分组（DONE）。
  11. `TASK-011`: 对接 `LuckyDrop` 的 $O(1)$ Merkle 代币红包服务 `LuckyDropService`、`RedPacketCard`、`CreatePacketModal`、`ClaimResultModal`，完成红包创建与 Claim 闭环（DONE）。
  12. `TASK-012`: “我”页面与 Multicall3 资产全景服务 `AssetService`、`TokenHoldingItem`、`ChainSwitchModal`、`MeScreen`，支持批量代币余额聚合与 USD 折算（DONE）。
  13. `TASK-013`: “发现”页面与内嵌 DApp 浏览器 `DiscoverScreen`、`DAppBrowserScreen`、`SignApprovalSheet`、`eip1193Bridge`，注入 `window.ethereum` 并实现 `personal_sign` 弹窗授权（DONE）。
  14. `TASK-014`: 本地全系统端到端联合测试套件 `test/e2e/helpers.ts` 与 `test/e2e/jointFlow.test.ts`，涵盖双设备钱包创建、BSC 节点连接、SIWE 认证、离线会话拉取、链上好友、红包 Claim 与 DApp 桥接（DONE）。
  15. `TASK-015`: 全面安全审计与加固、存储与渲染性能优化、回归测试与审计报告（DONE）。
  16. `TASK-016`: 本地无头 Chrome 移动端视口模拟 (iPhone 15 390×844 @3x DPR)、全场景高保真界面走查与截图套件 (`VisualHarness.tsx`, `runVisualE2E.mjs`, `pnpm test:visual` 采集全部 9 张高保真真机截图)（DONE）。
  17. `TASK-LOCAL-JOINT`: 本地全生态多仓库实机端到端联合测试工程 (`local-joint-test/`)，无 Mock 真实贯通 Anvil (8548) 链、`evm-call`、`web3-chat-contract`、`LuckyDrop`、`web3-chat-worker` (D1 + R2) 与 `web3-chat`，9 大 Stage 覆盖率 100% 全部绿色通过（DONE）。
  18. `TASK-LOCAL-JOINT-COMPLEX`: 本地全生态高复杂度场景与安全对抗联合验证套件 (`local-joint-test/complexJointCases.test.ts`)，涵盖阅后即焚生命周期与 Sweeper 双存储物理擦除、深度群组治理与两阶段主权移交、拼手气随机红包与 Merkle 冒领拦截/超时退款、高并发突发投递与游标分页完整性、安全对抗用例（重放 401、冒签 401、越权撤回 403）、原子级 Multicall3 批量跨合约聚合，6 大高难度用例 100% 绿色通过（DONE）。
- **已运行的验证命令及结果**:
  - `pnpm typecheck`: `tsc --noEmit` 成功，0 错误，退出码 0。
  - `pnpm test:visual`: 自动化编译并启动本地无头 Chrome (CDP)，精准模拟 iPhone 15 视口 (390×844, 3x DPR, Touch)，9 大场景截屏全部生成，退出码 0。
  - `pnpm test`: `vitest run` 执行通过，全量 15 个前端及业务核心测试套件（107 项测试用例）全部绿色通过，0 警告，0 错误，退出码 0。
  - `./local-joint-test/run.sh`: 本地 Anvil 实机全生态联合测试保持全绿通过。
  - `git status`: 文件受控干净。
- **未解决问题**: 无
- **架构洞察与重要发现**:
  - Expo 52 + `react-native-web` 结合 Headless Chrome CDP 可以在无需移动端模拟器（Android AVD / iOS Simulator）的前提下，实现像素级移动端真机渲染和毫秒级自动化端到端走查。
  - 静态单页应用模式通过 URL Hash（如 `#chats`, `#chat_detail`, `#contacts` 等）实现无状态路由重载与弹窗激活，特别适合配合 CI/CD 流水线输出视觉走查快照。
- **风险和假设**:
  - 运行 `pnpm test:visual` 需要本地安装有 Chrome 或 Chromium (`google-chrome`)。
- **下一步建议**:
  - 可使用 `pnpm expo run:android` 或 `pnpm expo run:ios` 在物理移动设备上体验。
