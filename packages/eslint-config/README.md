# `@repo/eslint-config`

基于 [`@antfu/eslint-config`](https://github.com/antfu/eslint-config) 的共享 ESLint 配置，供 admin、client、docs、`@repo/ui`、`@repo/utils` 使用。

```js
// eslint.config.js
import { defineConfig } from '@repo/eslint-config'

export default defineConfig({
  type: 'app',
  ignores: ['public/**'],
})
```

- 第一个参数会覆盖默认选项（TypeScript、Vue、CSS/HTML/Markdown 格式化），`ignores` 会追加到默认的 `dist`、`coverage` 之后。
- 额外的 flat config 作为后续参数传入，例如 `defineConfig({...}, ...pluginQuery.configs['flat/recommended'])`。
- 默认关闭 `pnpm.catalogs`：开启后 `pnpm/json-enforce-catalog` 会要求所有依赖进入根 catalog，并且即使不加 `--fix` 也会改写根 `pnpm-workspace.yaml`。
