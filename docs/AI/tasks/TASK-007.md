# TASK-007: WeChat-Style 4-Tab Navigation & Shell UI

## Objective
搭建微信操作体验的四标签页基础外壳（Chat, Contacts, Discover, Me），设计微信经典绿色调与暗黑模式适配的主题系统，以及流畅的页面路由骨架。

## Scope
- 配置底部导航栏组件（带微信风格图标、未读消息红点角标 Badge）。
- 创建 4 个核心 Tab 的空态/骨架占位 Screen（ChatScreen, ContactsScreen, DiscoverScreen, MeScreen）。
- 实现通用微信风格基础组件（NavigationBar, Badge, Avatar, SearchBar, ListItem）。
- 编写导航与主题渲染测试。

## Allowed Files
- `src/theme/colors.ts`
- `src/navigation/RootNavigator.tsx`
- `src/navigation/TabNavigator.tsx`
- `src/components/common/Badge.tsx`
- `src/components/common/HeaderBar.tsx`
- `test/navigation/navigation.test.ts`

## Dependencies
- TASK-001
- TASK-002

## Inputs and Outputs
- **Inputs**: 微信风格设计规范。
- **Outputs**: 可交互的 4-Tab 应用外壳。

## Acceptance Criteria
- [x] 4 个主 Tab 自由平滑切换。
- [x] 支持未读数红点徽标联动。
- [x] 界面风格与视觉层级贴近微信设计语言。
- [x] 单元测试通过。

## Verification Commands
- `pnpm typecheck`
- `pnpm test test/navigation/navigation.test.ts`

## Risks and Assumptions
- 确保组件在 Web 与移动设备上均有良好的响应式表现。

## Status
DONE
