# `@repo/ui`

monorepo 共享 UI 组件库，基于 [shadcn-vue](https://www.shadcn-vue.com/) 和 [reka-ui](https://reka-ui.com/)，供 `apps/admin` 和 `apps/client` 共用。包直接导出 TypeScript 源码，无独立构建步骤。

## 使用方式

```ts
// 组件
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'

// 样式工具
import { cn } from '@repo/ui/lib/utils'

// 共享 Tailwind 4 主题（在 CSS 入口中引入）
// @import '@repo/ui/styles/theme.css';
```

在 CSS 入口文件中，`@repo/ui/styles/theme.css` 必须紧跟 `tailwindcss` 之后引入：

```css
@import 'tailwindcss';
@import '@repo/ui/styles/theme.css';
```

`theme.css` 通过 `@source` 让 Tailwind 扫描到所有共享组件，无需额外配置。

## 组件列表

共 64 个组件，覆盖常用 UI 需求：

| 分类     | 组件                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| 输入     | `input`、`textarea`、`number-field`、`pin-input`、`input-otp`、`input-group`、`native-select`、`tags-input`      |
| 选择     | `select`、`combobox`、`radio-group`、`checkbox`、`switch`、`toggle`、`toggle-group`、`slider`                    |
| 布局     | `card`、`separator`、`resizable`、`scroll-area`、`aspect-ratio`                                                  |
| 导航     | `navigation-menu`、`menubar`、`breadcrumb`、`pagination`、`tabs`、`sidebar`                                      |
| 弹层     | `dialog`、`alert-dialog`、`sheet`、`drawer`、`popover`、`hover-card`、`context-menu`、`dropdown-menu`、`tooltip` |
| 反馈     | `alert`、`sonner`（toast）、`progress`、`skeleton`、`spinner`、`badge`                                           |
| 数据展示 | `table`、`chart`（Unovis）、`carousel`、`accordion`、`collapsible`、`calendar`、`range-calendar`                 |
| 表单     | `form`、`field`                                                                                                  |
| 其他     | `avatar`、`button`、`button-group`、`command`、`empty`、`item`、`kbd`、`marker`、`message`、`message-scroller`、`bubble`、`stepper` |

## 添加新组件

在 `packages/ui` 目录下运行 shadcn-vue CLI（其 `components.json` 别名已指向 `@repo/ui/*`）：

```bash
pnpm -C packages/ui exec shadcn-vue add <component-name>
```

生成后：
1. 将生成代码中的 `@repo/ui/...` 绝对导入改为相对路径
2. 在 `packages/ui/package.json` 中添加新引入的第三方依赖

修改 `packages/ui` 后，admin 和 client 都需要验证：

```bash
pnpm -C packages/ui lint
pnpm -C packages/ui check-types
pnpm -C apps/admin build
pnpm -C apps/client build
```

## 主题

两个应用各自在 `:root`、`.dark`、`.theme-*` 上定义自己的 CSS token（admin 用 oklch，client 用 hsl）。token 值必须是完整颜色，不是 Tailwind 3 的 HSL triplet。`theme.css` 负责将 token 映射为 Tailwind 工具类，并通过 `@source` 扫描所有共享组件源码。

## 开发约束

- 组件源码之间使用相对路径互相导入，保持与上游 shadcn-vue 的可比较性（不使用 TypeScript `paths` 别名）
- 组件源码目录被排除在 ESLint 之外（`eslint.config.js`），以便与上游保持 diff 一致性
- 无独立构建，直接导出 `.ts` / `.vue` 源码，消费方（Vite）负责编译
