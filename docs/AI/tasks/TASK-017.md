# TASK-017: Modern Web3 & WeChat Design System UI/UX Polish

## Objective
对整个 Web3 Chat App 进行全面的 UI/UX 现代化重构与视觉美化。引入成熟的矢量图标系统（`lucide-react-native` + `react-native-svg`）与现代 Web3 + 微信原生设计规范（色彩系统扩展、微质感阴影、平滑圆角、卡片微拟态、专业代币资产卡片与精致微交互），彻底淘汰简陋的纯文本 Emoji 图标与原始线框，使产品视觉质感跃升至商业级 Web3 移动应用标准。

## Scope
1. **统一现代矢量图标系统 (`src/components/common/Icon.tsx`)**:
   - 基于 `lucide-react-native` 封装跨端统一、高保真矢量图标组件。
   - 覆盖所有核心图标：导航、操作、状态、资产、红包、安全提示等。
2. **现代设计规范与主题拓展 (`src/theme/colors.ts`, `src/theme/design.ts`)**:
   - 保持已有核心品牌色彩兼容 (`#07C160`, `#95EC69`, `#FA5151`, `#EDEDED`)。
   - 扩充现代化 Web3 资产专属色（BNB Gold, USDT Emerald, LuckyDrop Ruby）。
   - 定义跨平台柔和阴影、微质感卡片边框、曲率圆角与现代排版系统。
3. **导航与全局壳层现代化 (`TabNavigator.tsx`, `HeaderBar.tsx`)**:
   - 底部 4-Tab：由 Emoji 升级为高质感矢量图标，增加激活微指示与精致数字/红点胶囊。
   - 顶部 HeaderBar：现代轻质感顶栏、iOS 规范返回箭头与右侧圆形操作按钮。
4. **聊天模块视觉重构 (`ConversationListScreen`, `ChatDetailScreen`, `MessageBubble`, `ChatInputBar`)**:
   - 会话列表：精致单聊/群聊矢量微质感头像、高亮未读胶囊、优雅时间戳与两行排版。
   - 聊天详情与气泡：精美微曲率气泡（我方微信绿/对方纯白）、30s 阅后即焚火焰胶囊、精美 LuckyDrop 链上金红红包卡片。
   - 输入栏：现代悬浮圆角输入框，精美加号与发送动作按钮。
5. **通讯录与添加好友 (`ContactsScreen`, `AddFriendScreen`)**:
   - 经典彩色微胶囊入口（新朋友、群聊、标签），精致搜索框与 A-Z 悬浮索引。
6. **发现页面与 DApp 授权 (`DiscoverScreen`, `SignApprovalSheet`)**:
   - 现代卡片式 Web3 探索目录，分类浅色药丸标签（DeFi, Social, Tools）。
   - 底部升起的 EIP-191 签名抽屉，带黄色安全盾牌与结构化参数卡片。
7. **“我”个人中心与多链资产 (`MeScreen`, `TokenHoldingItem`, `ChainSwitchModal`)**:
   - Web3 极客个人卡片，一键复制地址反馈与网络在线状态指示。
   - 现代大额总资产卡片，圆形快捷收/发操作入口，高品质 BNB/USDT/LUCKY 代币列表。
8. **LuckyDrop 链上红包弹窗 (`ClaimResultModal`)**:
   - 喜庆金红拱顶微渐变、金色开奖光环、代币大字排版与 Merkle 链上凭证卡片。
9. **回归与视觉验收**:
   - `pnpm typecheck` 0 错误。
   - `pnpm test` (107 个单元与集成测试) 全部通过。
   - `pnpm test:visual` 自动重构并捕获 9 大高保真真机场景截屏。

## Allowed Files
- `package.json`
- `src/theme/colors.ts`
- `src/theme/design.ts`
- `src/components/common/Icon.tsx`
- `src/components/common/HeaderBar.tsx`
- `src/navigation/TabNavigator.tsx`
- `src/features/chat/screens/ConversationListScreen.tsx`
- `src/features/chat/screens/ChatDetailScreen.tsx`
- `src/features/chat/components/MessageBubble.tsx`
- `src/features/chat/components/ChatInputBar.tsx`
- `src/features/contacts/screens/ContactsScreen.tsx`
- `src/features/contacts/screens/AddFriendScreen.tsx`
- `src/features/discover/screens/DiscoverScreen.tsx`
- `src/features/discover/components/SignApprovalSheet.tsx`
- `src/features/assets/screens/MeScreen.tsx`
- `src/features/assets/components/TokenHoldingItem.tsx`
- `src/features/assets/components/ChainSwitchModal.tsx`
- `src/features/packet/components/RedPacketCard.tsx`
- `src/features/packet/components/ClaimResultModal.tsx`
- `src/visual/VisualHarness.tsx`
- `test/visual/runVisualE2E.mjs`
- `docs/AI/tasks/TASK-017.md`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## Status
DONE
