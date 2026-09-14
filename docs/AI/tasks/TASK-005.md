# TASK-005: Local-First Storage Engine

## Objective
设计并实现客户端 Local-First 持久化存储引擎，管理会话、离线消息、未读数、同步时间戳游标以及社交关系缓存。

## Scope
- 封装持久化存储适配器 `StorageEngine`（支持 SQLite / AsyncStorage 适配层）。
- 实现 `ConversationRepository`：保存、查询、按最后消息时间倒序排列。
- 实现 `MessageRepository`：批量插入、游标分页、按 ID 查询、状态更新（pending -> sent -> delivered -> read -> recalled）。
- 实现 `SyncCheckpointRepository`：维护最新同步时间戳 `lastSyncTimestamp`。
- 编写存储引擎增删改查单元测试。

## Allowed Files
- `src/services/storage/StorageEngine.ts`
- `src/services/storage/repositories/ConversationRepo.ts`
- `src/services/storage/repositories/MessageRepo.ts`
- `src/services/storage/index.ts`
- `test/services/storage.test.ts`

## Dependencies
- TASK-001
- TASK-002

## Inputs and Outputs
- **Inputs**: 结构化会话与消息对象。
- **Outputs**: 具备 ACID/本地事务保证的高速离线数据库。

## Acceptance Criteria
- [x] 会话列表按最新消息时间正确排序。
- [x] 消息插入与状态流转无丢失。
- [x] 30秒撤回与已读焚毁在本地能即时标记。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/services/storage.test.ts`

## Risks and Assumptions
- 内存与存储占用需合理控制，单次游标拉取上限默认设为 50 条。

## Status
DONE
