# Docs

仓库文档站，基于 [VitePress](https://vitepress.dev/)。页面是本目录下的 Markdown（`index.md`、`guide/*.md`），站点配置在 `.vitepress/config.ts`。本 README 不会作为页面发布。

## 启动与检查

使用 Node.js **24.22+** 和根目录固定的 **pnpm 11.25.0**。在仓库根目录安装依赖并运行：

```sh
pnpm install --frozen-lockfile
pnpm -C apps/docs dev          # http://localhost:3001
pnpm -C apps/docs lint
pnpm -C apps/docs lint:fix
pnpm -C apps/docs check-types
pnpm -C apps/docs build        # 输出到 apps/docs/dist
pnpm -C apps/docs preview
```

开发端口固定为 3001，被占用时直接报错；预览也默认使用 3001。本站无独立测试脚本，`check-types` 检查 TypeScript 配置，`build` 验证站点生成与内部链接。

## 内容与配置

| 文件                                                   | 用途                                             |
| ------------------------------------------------------ | ------------------------------------------------ |
| [index.md](./index.md)                                 | 文档首页                                         |
| [guide/getting-started.md](./guide/getting-started.md) | 环境安装与本地启动                               |
| [guide/structure.md](./guide/structure.md)             | 应用和工作区结构                                 |
| [guide/shared-packages.md](./guide/shared-packages.md) | 共享 UI、工具及配置包                            |
| [guide/verification.md](./guide/verification.md)       | 检查、测试和构建                                 |
| `.vitepress/config.ts`                                 | 中文站点元信息、导航、侧边栏、本地搜索和输出目录 |

新增指南时同步 `.vitepress/config.ts` 的导航/侧边栏。当前启用 `cleanUrls`、本地搜索和基于 Git 的更新时间显示；`README.md` 通过 `srcExclude` 排除。

共享 ESLint 配置来自 `@repo/eslint-config`，TypeScript 基础配置来自 `@repo/typescript-config`。构建产物为 `apps/docs/dist/`，可部署到静态站点服务。应用功能与运行命令还可参阅[根 README](../../README.md)。
