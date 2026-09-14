# TASK-008: Chat Core Engine & Periodic Sync Service

## Objective
打通离线优先存储引擎与 Web3 Chat Worker，实现消息发送队列、重试控制、周期性增量拉取轮询（Periodic Sync）及消息状态同步闭环。

## Scope
- 实现 `ChatEngineService`：协调 StorageEngine 与 WorkerApiClient。
- 实现 `sendMessage` 管道：生成局部消息 -> 写本地 SQLite (`pending`) -> 发送 Worker -> 更新为 `sent`。
- 实现 `SyncService`：前台周期性（默认 8s）触发 `GET /sync?since=<lastSync>`，增量拉取新消息并合并落库。
- 实现自动送达与已读 ACK 调度器。
- 编写 ChatEngine 离线收发与同步模拟单元测试。

## Allowed Files
- `src/features/chat/ChatEngineService.ts`
- `src/features/chat/PeriodicSyncService.ts`
- `src/features/chat/index.ts`
- `test/features/chatEngine.test.ts`

## Dependencies
- TASK-005
- TASK-006

## Inputs and Outputs
- **Inputs**: 本地发信意图与网络轮询触发。
- **Outputs**: 稳定的 Local-First 双向消息同步内核。

## Acceptance Criteria
- [x] 离线时发信正常落库为 pending。
- [x] 网络恢复后自动发送并变更为 sent。
- [x] 周期性拉取准确推进增量时间戳游标。
- [x] 单元测试全部通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/features/chatEngine.test.ts`

## Risks and Assumptions
- 避免并发多次轮询产生竞态条件，引入同步互斥锁 (Sync Mutex)。

## Status
DONE
