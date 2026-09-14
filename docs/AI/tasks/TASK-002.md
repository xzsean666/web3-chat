# TASK-002: Common Domain Types & Data Models

## Objective
定义 Web3 Chat 客户端全链路的核心领域数据模型与 TypeScript 接口类型，为会话、消息、联系人、群组、红包、钱包及链配置提供单一事实源类型定义。

## Scope
- 定义会话模型 `Conversation`（单聊 `dm:`、群聊 `group:`）。
- 定义消息模型 `ChatMessage`（文本、红包、系统通知；状态：`pending`, `sent`, `delivered`, `read`, `recalled`）。
- 定义联系人与群组模型 `Contact`, `Group`, `GroupMember`。
- 定义红包模型 `LuckyDropPacket`（单聊/群聊、Merkle 凭证、Claim 状态）。
- 定义钱包与链配置模型 `WalletAccount`, `ChainConfig`, `TokenAsset`。
- 编写领域模型的类型断言与工厂校验单元测试。

## Allowed Files
- `src/types/chat.ts`
- `src/types/contact.ts`
- `src/types/wallet.ts`
- `src/types/packet.ts`
- `src/types/index.ts`
- `test/types/models.test.ts`

## Dependencies
- TASK-001

## Inputs and Outputs
- **Inputs**: `web3-chat-worker`, `web3-chat-contract`, `LuckyDrop` 协议接口规范。
- **Outputs**: 强类型定义导出与模型单元测试。

## Acceptance Criteria
- [x] 所有领域模型满足 Worker 与合约的数据格式对应关系。
- [x] 导出统一的 `src/types/index.ts`。
- [x] 单元测试验证模型数据结构的完备性。
- [x] `pnpm typecheck` 通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/types/models.test.ts`

## Risks and Assumptions
- 需保持与 Worker D1 结构及合约 ABI 的字段命名语义对齐。

## Status
DONE
