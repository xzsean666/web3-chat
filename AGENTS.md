# Project Rules & Agent Guidelines (项目规则与代理守则)

## 1. GitHub 账户与认证路由规范
本项目位于 `/ssd0/git/web3-chat`，属于 `/ssd0/git` 目录体系：
- **指定 GitHub 账号**: `xzsean666`
- **执行规范**:
  - 在执行任何 `gh` 命令或 Git 认证操作前，必须确保当前活跃账号为 `xzsean666`。
  - 如需切换账号，执行：
    ```bash
    gh auth switch --user xzsean666
    ```
  - 未经用户明确许可，不得执行 `git push`、`git reset --hard`、`git checkout` 等破坏性或发布性操作。

## 2. 包管理器与环境规范
- 统一使用 `pnpm` 作为包管理器。
- 运行环境要求：Node.js >= 22。
- 移动端框架：React Native + Expo (TypeScript)。
- 严格验证：未实际运行过的命令和测试不得声称通过。

## 3. 事实来源 (Source of Truth)
- `AGENTS.md`：项目全局规则与环境约束。
- `docs/AI_AGENT_PROMPT.md`：原始项目开发提示词与架构要求。
- `docs/AI/GOAL.md`：产品功能全景与边界（明确 In-Scope 与 Out-of-Scope）。
- `docs/AI/TASK_INDEX.md`：任务状态流与依赖索引。
- `docs/AI/SESSION_STATE.md`：跨 session 恢复与当前执行快照。
- `docs/AI/ARCHITECTURE.md`：系统架构与模块划分。
- `docs/AI/DECISIONS.md`：技术决策记录 (ADR)。
- `docs/AI/tasks/TASK-xxx.md`：具体任务的验收指标与可执行范围。

## 4. 架构与依赖复用铁律
本项目不是从零开发 Web3 基础设施，核心原则为：
`Reuse Existing` -> `Integrate` -> `Only Modify When Necessary`。

1. **移动端 App (`web3-chat`)**: 当前项目，负责整个移动端 App，类似微信的 4-Tab 体验 (Chat, Contacts, Discover, Me)。
2. **Chat Worker (`/ssd0/git/web3-chat-worker`)**: 负责 Chat 相关后端能力（D1 瞬态消息流转、R2 媒体存储、EIP-191 鉴权、周期性增量同步 `/sync`）。
3. **Social Contract (`/ssd0/git/web3-chat-contract`)**: 负责用户 Profile、双向好友、群组等链上社交关系（`@web3-chat/sdk` / `ChatStorageFactory.sol`）。
4. **Red Packet (`/ssd0/git/LuckyDrop`)**: 负责 Token 红包相关逻辑（`@luckydrop/sdk` / `LuckyDrop.sol`），支持单聊与群聊红包。
5. **EVM SDK (`/ssd0/git/evm-call`)**: **所有 Web3 / EVM 交互统一使用 `evm-call`**。不要在 `web3-chat` 中重新实现另一套 EVM 交互逻辑，严禁引入冗余重型 Web3 全家桶。

## 5. 工程开发守则
1. 一次只处理一个 Goal 与一个当前 Task。
2. 一个 session 默认最多完成一个 Task。
3. 不实现当前 Task 之外的功能，不修改与任务无关的文件。
4. 不破坏或覆盖已有代码，不执行破坏性 git 操作。
5. 修改前必须先输出计划（Request Type, Goal, Current Behavior, Current Task, Dependencies, Files To Read, Files To Modify, Files To Create, Implementation Approach, Acceptance Criteria, Verification Method, Risks and Assumptions）。
6. Task 状态严格按照 `TODO -> IN_PROGRESS -> REVIEW -> DONE` 流转。
7. 每个 session 结束前必须更新 `docs/AI/SESSION_STATE.md` 并按标准交接格式输出报告。
