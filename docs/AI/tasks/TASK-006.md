# TASK-006: Web3 Chat Worker Client & SIWE Authentication Service

## Objective
对接 `/ssd0/git/web3-chat-worker` 后端状态节点，实现基于 EIP-191 签名的 SIWE 挑战应答鉴权流程、Session Token 管理以及 HTTP API 客户端。

## Scope
- 封装 `WorkerApiClient`：支持请求重试、超时控制、自动携带 Bearer Token。
- 实现认证流程：`POST /auth/nonce` 获取挑战 -> 本地钱包签名 -> `POST /auth/verify` 换取 Session Token。
- 封装消息相关接口：`POST /messages`（发送消息）、`POST /messages/:id/ack`（送达确认）、`POST /messages/:id/read`（已读确认）、`POST /messages/:id/recall`（30s 撤回）。
- 封装全量增量同步接口：`GET /sync?since=<timestamp>&limit=<number>`。
- 编写 Mock / 集成单元测试。

## Allowed Files
- `src/services/worker/WorkerApiClient.ts`
- `src/services/worker/AuthService.ts`
- `src/services/worker/index.ts`
- `test/services/worker.test.ts`

## Dependencies
- TASK-001
- TASK-002
- TASK-004

## Inputs and Outputs
- **Inputs**: 钱包签名实例与 Worker 端点配置。
- **Outputs**: 具备自动刷新与合法 Bearer 会话的 Worker 客户端。

## Acceptance Criteria
- [x] 严格对齐 `web3-chat-worker` 的 API 规范与返回结构。
- [x] 认证鉴权凭据妥善持久化。
- [x] 单元测试模拟通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/services/worker.test.ts`

## Risks and Assumptions
- 网络异常或 401 时能自动触发重新签名鉴权。

## Status
DONE
