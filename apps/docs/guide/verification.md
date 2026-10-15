# 检查与测试

根命令通过 Turbo 调度提供对应脚本的工作区：

| 命令                 | 覆盖范围                                                      |
| -------------------- | ------------------------------------------------------------- |
| `pnpm lint`          | admin、client、server、docs、`@repo/ui`、`@repo/utils`        |
| `pnpm check-types`   | admin、client、server、docs、`@repo/ui`、`@repo/utils`        |
| `pnpm test`          | admin、client、server、`@repo/utils`                          |
| `pnpm test:coverage` | 同上，覆盖率报告输出到各自的 `coverage/`                      |
| `pnpm test:e2e`      | server                                                        |
| `pnpm build`         | admin、client、server、docs；共享包直接导出源码，没有构建步骤 |

## 单个工作区

```sh
pnpm -C apps/admin lint:fix
pnpm -C apps/admin build
pnpm -C apps/admin test src/utils/__tests__/env.test.ts

pnpm -C apps/client lint:fix
pnpm -C apps/client build
pnpm -C apps/client test src/composables/__tests__/useCollecty.test.ts

pnpm -C packages/utils test
pnpm -C packages/ui check-types

pnpm -C apps/server exec vitest run src/app.controller.spec.ts
pnpm -C apps/docs build
```

- 测试统一使用 Vitest；`vitest`、`@vitest/coverage-v8`、`happy-dom`、`@vue/test-utils` 的版本来自根 catalog。
- 需要 DOM 的测试在文件顶部声明 `// @vitest-environment happy-dom`。
- 后端 E2E 使用默认 Express 适配器创建测试应用，通过 E2E 不等于验证了 Fastify 启动流程。

## 格式化

- admin、client、docs、共享包：`pnpm -C <dir> lint:fix`（Antfu ESLint 同时负责格式化）。
- server：`pnpm -C apps/server format`（本地 Prettier）。
- 根 `pnpm format` 只处理 `.prettierignore` 之外的文件。
