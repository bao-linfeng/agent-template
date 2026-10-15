# 共享包

所有 `@repo/*` 包都是 Just-in-Time 内部包：直接导出 TypeScript / Vue 源码，没有独立构建步骤，由使用方的 Vite 编译。

## `@repo/ui`

shadcn-vue（new-york 风格，reka-ui + Tailwind 4）组件，admin 和 client 共用。

```ts
import { Button } from '@repo/ui/components/button'
import { Sheet, SheetContent, SheetTrigger } from '@repo/ui/components/sheet'
import { cn } from '@repo/ui/lib/utils'
```

在应用的入口样式中，紧跟 `tailwindcss` 引入共享主题，然后定义自己的设计 token：

```css
@import 'tailwindcss';
@import '@repo/ui/styles/theme.css';

:root {
  --background: oklch(1 0 0);
  --primary: oklch(0.205 0 0);
  /* ... */
  --radius: 0.625rem;
}
```

`theme.css` 负责：

- 引入 `tw-animate-css`，声明 `dark` 变体（`.dark` 祖先）；
- 通过 `@source '../components'` 让 Tailwind 扫描共享组件里的类名；
- 把 `--background`、`--primary`、`--sidebar-*`、`--chart-*` 等 CSS 变量映射为 Tailwind 颜色和圆角；
- 基础层：边框颜色、`body` 背景和前景色。

token 的值必须是完整颜色（`oklch(...)`、`hsl(...)` 等），不能是 Tailwind 3 时代的 `222 84% 5%` 三元组。

### 缩小 CSS 体积

Tailwind 无法按 import 摇树，默认会为全部共享组件生成样式（client 约多 9 kB gzip）。对体积敏感的应用可以排除用不到的组件目录。路径要写**真实的工作区路径**，不能写 `node_modules/@repo/ui` 软链接路径：

```css
/* apps/client/src/assets/index.css */
@source not '../../../../packages/ui/src/components/{sidebar,chart,calendar,table}';
```

被排除的组件之后如果被使用，样式会静默缺失，修改列表时要同步检查。

### 新增组件

在 `packages/ui` 目录下使用 shadcn-vue CLI：

```sh
cd packages/ui
pnpm dlx shadcn-vue@latest add <component>
```

`components.json` 的别名指向 `@repo/ui/*`。生成后把组件里的 `@repo/ui/lib/utils`、`@repo/ui/components/xxx` 导入改为相对路径（`../../lib/utils`、`../xxx`）：JIT 包由使用方编译，包内源码不能依赖 TypeScript `paths`。如果新组件引入了新的第三方依赖，需要加到 `packages/ui/package.json`。

组件源码保持与上游一致，不参与 ESLint 格式化。

## `@repo/utils`

与框架无关的纯函数，带单元测试：

| 函数                          | 说明                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `cn(...inputs)`               | 合并 class 名并解决 Tailwind 冲突（`cn` 包）                  |
| `isExternalUrl(url?)`         | 判断是否为 `http(s)://` 或 `//` 开头的外部链接                |
| `applyThemeClass(theme, el?)` | 替换元素（默认根元素）上的 `theme-*` 类，保留 `dark` 等其他类 |

```sh
pnpm -C packages/utils test
```

## `@repo/eslint-config`

基于 `@antfu/eslint-config`，统一开启 TypeScript、Vue、CSS/HTML/Markdown 格式化，并关闭 `pnpm.catalogs`（否则会要求所有依赖进入 catalog，且会改写根 `pnpm-workspace.yaml`）。

```js
import { defineConfig } from '@repo/eslint-config'

export default defineConfig({ type: 'app', ignores: ['public/**'] })
```

## `@repo/typescript-config`

`base.json`：面向 Vite 的严格配置（`moduleResolution: Bundler`、`noEmit`、`noUnusedLocals` 等）。应用在此基础上补充自己的 `paths` 和 `types`。
