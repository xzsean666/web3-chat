# TASK-015: Comprehensive Security & Performance Hardening & Audit

## Objective
全面审计 Web3 Chat 客户端系统的安全性与性能，针对内存私钥泄漏隐患、EIP-1193 桥接参数解析缺陷、跨平台 Buffer 兼容性、存储 I/O 串行阻塞与重复索引写入瓶颈、UI 重复渲染与样式弃用告警实施专项加固与优化，并输出完整审计报告。

## Scope
1. **安全加固 (Security Hardening)**:
   - 修复 `eip1193Bridge.ts` 中 `personal_sign` 在短消息（<= 42 字节）时误将地址当消息的解析缺陷。
   - 替换 `Buffer.from` 为 `viem` 原生 `hexToString` / `isHex`，防止在 Hermes / JSC 移动端抛出 `Buffer is not defined` 崩溃。
   - 对 `createEip1193InpageScript` 注入变量实施符号过滤转义，防止脚本注入与原型逃逸。
   - 增加 `WalletCoreService.clearSignerCache` 机制，在删除钱包时清除内存堆中的 Signer 实例，消除私钥驻留泄露风险。
   - 增强私钥（必须为 32-byte hex）与钱包地址格式的严格前置校验。
   - 消除 `AuthService` 对 `KeyStoreService` 内部私有 adapter 属性的非法侵入，规范化 Session 存储接口。
2. **性能优化 (Performance Optimization)**:
   - `ConversationRepo` 与 `MessageRepo` 的列表查询从 $O(N)$ 串行 await 改为 `Promise.all` 并发读取。
   - `MessageRepo.batchInsertMessages` 实现会话分组与索引合并批量更新，消除重复读写索引的 I/O 放大。
   - `PeriodicSyncService` 同步流程改为并发存在性探测与批量更新。
   - `MessageBubble` 添加 `React.memo`，列表 `renderItem` 与分隔组件添加 `useCallback` 缓存，FlatList 增加性能调优参数。
   - 修复 React Native 0.76+ / RN Web 上的 `shadow*` 样式弃用告警。
3. **回归与验证 (Verification & Audit)**:
   - 编写专门的安全加固与性能测试套件 `test/services/securityHardening.test.ts`。
   - 输出详尽的全面审计与优化文档 `docs/AI/AUDIT_AND_OPTIMIZATION.md`。

## Allowed Files
- `src/features/discover/bridge/eip1193Bridge.ts`
- `src/services/wallet/WalletCoreService.ts`
- `src/services/wallet/KeyStoreService.ts`
- `src/services/worker/AuthService.ts`
- `src/services/storage/repositories/ConversationRepo.ts`
- `src/services/storage/repositories/MessageRepo.ts`
- `src/features/chat/PeriodicSyncService.ts`
- `src/features/chat/components/MessageBubble.tsx`
- `src/features/chat/screens/ChatDetailScreen.tsx`
- `src/features/chat/screens/ConversationListScreen.tsx`
- `src/features/packet/components/RedPacketCard.tsx`
- `src/features/packet/components/CreatePacketModal.tsx`
- `src/features/packet/components/ClaimResultModal.tsx`
- `src/features/assets/screens/MeScreen.tsx`
- `test/services/securityHardening.test.ts`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`
- `docs/AI/AUDIT_AND_OPTIMIZATION.md`

## Status
DONE
