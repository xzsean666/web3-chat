# TASK-009: Chat UI Components & 1:1 / Group Conversation Screen

## Objective
打造微信级质感的聊天 UI，包含会话列表页面（最近联系人/群组、未读数、最后发言）与对话详情流（气泡布局、发送状态指示、文本输入框）。

## Scope
- 实现 `ConversationListScreen`（下拉刷新、长按置顶/删除、时间戳格式化）。
- 实现 `ChatDetailScreen`（消息气泡流、左右区分发送方/接收方、发送中/失败重试图标）。
- 实现 `ChatInputBar`（输入框、发送按钮、"+"号扩展功能菜单面板）。
- 支持长按消息弹出 30 秒内“撤回”与“复制”菜单。
- 编写聊天 UI 交互逻辑测试。

## Allowed Files
- `src/features/chat/screens/ConversationListScreen.tsx`
- `src/features/chat/screens/ChatDetailScreen.tsx`
- `src/features/chat/components/MessageBubble.tsx`
- `src/features/chat/components/ChatInputBar.tsx`
- `test/features/chatUI.test.ts`

## Dependencies
- TASK-007
- TASK-008

## Inputs and Outputs
- **Inputs**: 会话数据流与用户触控输入。
- **Outputs**: 完整微信体验的聊天界面。

## Acceptance Criteria
- [x] 会话列表与消息流顺畅渲染无卡顿。
- [x] 消息发送状态（圈圈转动 -> 成功）视觉反馈正常。
- [x] 撤回动作在 30 秒倒计时内可正常触发。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/features/chatUI.test.ts`

## Risks and Assumptions
- 软键盘弹起与消息流底部自动滚动对齐。

## Status
DONE
