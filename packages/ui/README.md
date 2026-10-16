# `@repo/ui`

monorepo 共享 UI 组件库，基于 shadcn-vue 和 reka-ui，供 `apps/admin` 和 `apps/client` 共用。包直接导出 TypeScript / Vue 源码，无独立构建步骤，组件内部显式导入 Vue API，不依赖管理端自动导入。

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

当前有 64 个组件目录（每个目录可能导出多个子组件），覆盖常用 UI 需求：

| 分类     | 组件                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 输入     | `input`、`textarea`、`number-field`、`pin-input`、`input-otp`、`input-group`、`native-select`、`tags-input`                         |
| 选择     | `select`、`combobox`、`radio-group`、`checkbox`、`switch`、`toggle`、`toggle-group`、`slider`                                       |
| 布局     | `card`、`separator`、`resizable`、`scroll-area`、`aspect-ratio`                                                                     |
| 导航     | `navigation-menu`、`menubar`、`breadcrumb`、`pagination`、`tabs`、`sidebar`                                                         |
| 弹层     | `dialog`、`alert-dialog`、`sheet`、`drawer`、`popover`、`hover-card`、`context-menu`、`dropdown-menu`、`tooltip`                    |
| 反馈     | `alert`、`sonner`（toast）、`progress`、`skeleton`、`spinner`、`badge`                                                              |
| 数据展示 | `table`、`chart`（Unovis）、`carousel`、`accordion`、`collapsible`、`calendar`、`range-calendar`                                    |
| 表单     | `form`、`field`、`label`                                                                                                            |
| 其他     | `avatar`、`button`、`button-group`、`command`、`empty`、`item`、`kbd`、`marker`、`message`、`message-scroller`、`bubble`、`stepper` |

## 添加新组件

先从仓库根目录安装依赖（Node.js 24.22+、pnpm 11.25.0）。添加组件时以 `packages/ui` 为 CLI 工作目录，其 `components.json` 别名已指向 `@repo/ui/*`；当前包没有安装 `shadcn-vue` CLI，使用临时 CLI 或已准备好的 CLI 执行 `add <component-name>`。

生成后：

1. 将生成代码中的 `@repo/ui/...` 绝对导入改为相对路径
2. 在 `packages/ui/package.json` 中添加新引入的第三方依赖
3. 共享版本使用根 `pnpm-workspace.yaml` catalog，依赖变更后从根目录运行 `pnpm install` 更新唯一锁文件

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
- `@repo/ui/lib/utils` 从 `@repo/utils` 复用 `cn`；组件按 `@repo/ui/components/<目录名>` 导入，没有整包组件入口
- 本包没有独立 `test` 脚本，交互行为通过消费方的组件测试验证
