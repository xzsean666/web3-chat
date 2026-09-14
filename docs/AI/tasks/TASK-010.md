# TASK-010: Contacts Service & Screen (web3-chat-contract Integration)

## Objective
对接 `/ssd0/git/web3-chat-contract`，实现通讯录功能：读取并展示链上已确认好友、用户加入的群组列表、好友添加/确认流程及个人备注。

## Scope
- 封装 `SocialContractService`：对接 `ChatStorageFactory.sol` 与 `RelationshipManager.sol`。
- 实现查询用户好友列表、群组反向索引（`getUserGroups`）。
- 实现添加好友申请与链上确认方法。
- 实现 `ContactsScreen`（微信风格好友字母索引列表、新的朋友、群聊入口）。
- 编写 Contacts 业务单元测试。

## Allowed Files
- `src/features/contacts/SocialContractService.ts`
- `src/features/contacts/screens/ContactsScreen.tsx`
- `src/features/contacts/screens/AddFriendScreen.tsx`
- `src/features/contacts/index.ts`
- `test/features/contacts.test.ts`

## Dependencies
- TASK-003
- TASK-007

## Inputs and Outputs
- **Inputs**: 用户钱包地址与链上合约。
- **Outputs**: 完整的去中心化好友与群组列表。

## Acceptance Criteria
- [x] 准确解析链上好友状态（Pending, Confirmed, Blocked）。
- [x] 通讯录支持拼音/字母排序展示。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/features/contacts.test.ts`

## Risks and Assumptions
- 合约读取失败时平滑降级展示本地离线通讯录。

## Status
DONE
