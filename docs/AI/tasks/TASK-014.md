# TASK-014: Local Joint E2E Testing & Verification Suite

## Objective
打通全系统联合集成测试套件，在本地模拟运行完整的端到端链路：钱包创建 -> BSC Testnet 节点通信 -> Worker SIWE 认证 -> 会话发信与周期拉取 -> 链上社交发现 -> LuckyDrop 红包生成与领取。

## Scope
- 编写端到端联合测试脚本 `test/e2e/jointFlow.test.ts`。
- 校验 Local-First 离线写入与网络恢复后同步一致性。
- 校验红包 Merkle 验证与 Claim 全流程闭环。
- 汇总自动化测试执行与系统交付质量报告。

## Allowed Files
- `test/e2e/jointFlow.test.ts`
- `test/e2e/helpers.ts`

## Dependencies
- TASK-001 到 TASK-013 全部完成

## Inputs and Outputs
- **Inputs**: 各子模块及已有周边项目环境。
- **Outputs**: 全绿色通过的端到端集成测试报告。

## Acceptance Criteria
- [x] 联合流程测试无断言失败。
- [x] 所有代码均通过 TypeScript 静态类型检查与代码规范检查。

## Verification Commands
- `pnpm test test/e2e/jointFlow.test.ts`
- `pnpm test`
- `pnpm typecheck`

## Risks and Assumptions
- 避免对真实链和真实服务器产生破坏性状态写入，采用本地沙箱/Mock 隔离。

## Status
DONE
