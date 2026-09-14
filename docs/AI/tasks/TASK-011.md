# TASK-011: LuckyDrop Red Packet Integration Service & Chat Card Component

## Objective
集成 `/ssd0/git/LuckyDrop` 协议，在客户端实现常数 Gas $O(1)$ 的 ERC-20 Token 红包（单聊/群聊），并在聊天流中呈现可领取的交互红包卡片。

## Scope
- 封装 `LuckyDropService`：构造 Merkle 树、构建 `createPacket` 与 `claim` 交易 Payload。
- 实现发红包弹窗 `CreatePacketModal`（支持输入代币、总金额、份数、祝福语）。
- 实现聊天卡片 `RedPacketCard`（展示红包状态：未领、已领完、已过期）。
- 实现抢红包动作与领取结果弹窗 `ClaimResultModal`。
- 编写红包创建与 Merkle 证明验证单元测试。

## Allowed Files
- `src/features/packet/LuckyDropService.ts`
- `src/features/packet/components/RedPacketCard.tsx`
- `src/features/packet/components/CreatePacketModal.tsx`
- `src/features/packet/components/ClaimResultModal.tsx`
- `test/features/packet.test.ts`

## Dependencies
- TASK-003
- TASK-004
- TASK-009

## Inputs and Outputs
- **Inputs**: 发包参数（代币、数量、份数）与领包请求。
- **Outputs**: 链上 Merkle 红包创建与 Claim 交互。

## Acceptance Criteria
- [x] Merkle Tree 与 Proof 格式完全与 `LuckyDrop.sol` 兼容。
- [x] 聊天卡片正确渲染并响应点击抢红包。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/features/packet.test.ts`

## Risks and Assumptions
- 发红包前需检查并引导用户完成 ERC-20 Token Allowance 授权。

## Status
DONE
