# TASK-001: Initialize Expo React Native TypeScript Scaffolding & Base Tooling

## Objective
搭建标准的 Expo + React Native + TypeScript 项目骨架，配置依赖体系、TypeScript 编译配置、测试运行器（Vitest/Jest）与启动入口，确保类型检查与基础测试全部通过。

## Scope
- 配置 `package.json`（包含 expo, react, react-native 等核心依赖与构建/类型检查/测试脚本）。
- 配置 `tsconfig.json`（支持 React Native JSX、路径别名与严格模式）。
- 配置 `app.json`（Expo 移动应用元数据，名称为 "Web3 Chat"）。
- 创建应用入口文件 `App.tsx`。
- 配置测试环境并编写基础冒烟测试。
- 配置 `.gitignore` 排除 node_modules、构建缓存与临时文件。

## Allowed Files
- `package.json`
- `tsconfig.json`
- `app.json`
- `App.tsx`
- `index.ts`
- `.gitignore`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `vitest.config.ts`
- `test/App.test.ts`

## Dependencies
- None

## Inputs and Outputs
- **Inputs**: Node.js 24 + pnpm 运行环境。
- **Outputs**: 可执行 `pnpm typecheck` 与 `pnpm test` 且无任何报错的项目骨架。

## Acceptance Criteria
- [x] `package.json` 包含准确的项目描述、依赖与脚本命令。
- [x] `tsconfig.json` 正确解析 TypeScript。
- [x] `App.tsx` 成功导出符合 React Native 规范的根组件。
- [x] `pnpm typecheck` 执行成功，0 错误。
- [x] `pnpm test` 执行成功，基础单元测试通过。

## Verification Commands
- `pnpm install`
- `pnpm typecheck`
- `pnpm test`

## Risks and Assumptions
- Expo 与 Node.js 24 / pnpm 兼容性：已通过 pnpm 12 `pnpm-workspace.yaml` (allowBuilds) 与 vitest react-native-web 别名完美解决。

## Status
DONE
