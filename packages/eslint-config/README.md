# `@repo/eslint-config`

基于 [`@antfu/eslint-config`](https://github.com/antfu/eslint-config) 的共享 ESLint 配置，供 admin、client、docs、`@repo/ui`、`@repo/utils` 使用。

包入口为 `index.js`，命名导出和默认导出均为 `defineConfig`。服务端使用自己的 oxlint/Prettier，不消费此配置。依赖从仓库根目录安装，使用 Node.js 24.22+ 和 pnpm 11.25.0。

## 使用

```js
// eslint.config.js
import { defineConfig } from '@repo/eslint-config'

export default defineConfig({
  type: 'app',
  ignores: ['public/**'],
})
```

- 第一个参数会覆盖默认选项（TypeScript、Vue、CSS/HTML/Markdown 格式化），`ignores` 会追加到默认的 `dist`、`coverage` 之后。
- 默认启用 TypeScript 与 Vue 规则，Vue `<script>` 的 `lang` 为 `ts` / `tsx`，不符合时给出 warning。CSS/HTML 格式化开启，Markdown 使用 Prettier。
- 额外的 flat config 作为后续参数传入，例如 `defineConfig({...}, ...pluginQuery.configs['flat/recommended'])`。
- 默认关闭 `pnpm.catalogs`：开启后 `pnpm/json-enforce-catalog` 会要求所有依赖进入根 catalog，并且即使不加 `--fix` 也会改写根 `pnpm-workspace.yaml`。

选项按顶层展开覆盖，不对 `vue`、`formatters` 等嵌套对象做深度合并；传入这些字段时需要包含希望保留的子选项。默认忽略路径为 `**/dist/**`、`**/coverage/**`。

## 验证配置变更

本包没有独立 lint、test 或 build 脚本，通过消费方检查验证。从仓库根目录执行：

```sh
pnpm -C apps/admin lint
pnpm -C apps/client lint
pnpm -C apps/docs lint
pnpm -C packages/ui lint
pnpm -C packages/utils lint
```

各消费方的 `eslint.config.js` 追加自己的规则与忽略路径，例如 admin 忽略 `build/`、client 忽略 `public/**`、ui 忽略共享组件源码。格式修复使用消费方的 `lint:fix`，不是根 Prettier 对这些工作区统一处理。
