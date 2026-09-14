# Web3 Chat AI Agent Project Development Specification

## 1. Project Prompt & Principles

你是一个在现有代码仓库中工作的工程开发代理。你的任务是：在遵守系统指令、开发者
指令和仓库规则的前提下，完成当前任务，保持代码可维护、可测试、可升级，并为下一
次 session 留下清晰状态。
不要猜测，不要扩大范围，不要一次实现多个任务。

### 事实来源
- 项目规则：`AGENTS.md`
- 总目标：`docs/AI/GOAL.md`
- 任务索引：`docs/AI/TASK_INDEX.md`
- 当前状态：`docs/AI/SESSION_STATE.md`
- 当前任务：`docs/AI/tasks/TASK-xxx.md`
- 架构说明：`docs/AI/ARCHITECTURE.md`
- 重要决策：`docs/AI/DECISIONS.md`

### 工作原则
1. 一次只处理一个 Goal 和一个当前 Task。
2. 一个 session 默认最多完成一个 Task。
3. 不实现当前 Task 之外的功能。
4. 不修改与任务无关的文件。
5. 不删除、覆盖或回滚用户已有修改。
6. 不执行 reset、checkout、递归删除等破坏性操作。
7. 不主动提交、推送、发布或修改生产环境。
8. 不添加依赖，除非任务明确需要且现有功能无法满足。
9. 不假设使用某种语言、框架、包管理器或测试工具。
10. 所有结论必须基于实际读取或实际运行的结果。
11. 没有运行过的测试不得声称通过。
12. 发现额外工作时，创建新 Task，不要立即实现。

---

## 2. Web3 Chat Architecture Specification

### 2.1 Project Overview
构建一个类似微信操作体验的 Web3 社交 App。
- 技术栈：React Native + Expo + TypeScript
- MVP 目前只支持 BSC Testnet（兼具多链切换架构设计）
- 核心能力：
  - Chat
  - Friends / Groups
  - Token Red Packet
  - Wallet
  - DApp Browser
  - Assets / Holdings

### 2.2 Existing Repositories
- **App**: `/ssd0/git/web3-chat` (React Native + Expo)
- **Chat Worker**: `/ssd0/git/web3-chat-worker` (Chat 后端状态节点)
- **Social Contract**: `/ssd0/git/web3-chat-contract` (用户、好友、群组链上关系)
- **Red Packet**: `/ssd0/git/LuckyDrop` (Token 红包合约与 SDK)
- **EVM SDK**: `/ssd0/git/evm-call` (**所有 Web3 / EVM 交互统一使用 `evm-call`**)

### 2.3 App Structure (4 Tabs)
- **Chat**: Local First + Periodic Sync（对接 `web3-chat-worker`，1:1 与群聊、文本、Token 红包卡片）
- **Contacts**: 对接 `web3-chat-contract` 维护链上好友与群组
- **Discover**: 内置类似 MetaMask 的 DApp Browser（离线主页、Web3 交互、签名/交易）
- **Me**: 用户基础信息、Wallet、Assets、Holdings Breakdown、Settings

### 2.4 Architecture Principle
```text
Reuse Existing -> Integrate -> Only Modify When Necessary
```
不要重复实现已有功能，也不要为了架构重构已有项目。
