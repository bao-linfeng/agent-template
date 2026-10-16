# BuildY 页面构建器

随 [Vue 客户端](../../README.md) 发布的独立静态页面构建器。入口为 `index.html`，编辑器为 `editor.html`；由 `public/` 原样复制到客户端构建产物中，不经过 Vue/TypeScript 编译。

## 本地使用

先在仓库根目录安装依赖并启动客户端：

```sh
pnpm install --frozen-lockfile
pnpm -C apps/client dev
```

1. 在 <http://localhost:5174/hero/base> 等展示页收藏需要的区块。
2. 通过导航栏的 BuildY 入口，或直接打开 <http://localhost:5174/buildy/index.html>。
3. 有尚未导入的收藏时，点击 `Get UI Blocks`，加载区块后页面会刷新。
4. 将区块加入布局，拖动排序、编辑内容并调整页面配置。
5. 使用 JSON 导入/导出保存项目，或导出 HTML。

构建器与 Vue 展示页必须处于同一来源（协议、域名和端口相同），才能共享 localStorage。请通过客户端开发服务器或部署站点访问；区块读取使用 HTTP 路径。

## 已有能力

- 区块选择、拖放排序和内容编辑。
- 亮暗模式、预览与独立编辑器。
- 项目 JSON 导入/导出、HTML 导出。
- Tailwind 配置、页面样式和页面骨架编辑。
- 浏览器本地保存布局和区块，不依赖 NestJS 的账号或数据库。

## 与客户端的数据约定

| 存储键/字段             | 用途                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `uiCollection`          | Collecty 收藏数组，每项含 `id`、`path`、`timestamp`             |
| `currentState.blocks`   | 已导入的区块，以带随机后缀的收藏 ID 为键                        |
| `currentState.layout`   | 布局状态                                                        |
| `currentState.sceleton` | 页面配置、Tailwind 配置、主题、圆角和样式；字段名按现有代码拼写 |
| `darkMode`              | 构建器亮暗模式（字符串 `true` / `false`）                       |

`js/favourites-loader.js` 将收藏路径转换为静态数据地址：`/hero/base` → `/api/pages/hero-base.json`，首页 → `/api/pages/home.json`。这些文件来自客户端 `public/api/pages/`，不是 NestJS API。

导入时会先清空 `currentState.blocks`，再根据当前收藏重新加载；其他顶层字段保留。匹配时移除收藏 ID 最后的随机后缀，再与 JSON 中区块的 `id` 做不区分大小写比较。新增区块或修改路由时，需要同步 JSON 文件名、区块 ID 和 HTML 内容。

当前 `/hero/split-full` 按加载规则会请求 `hero-split-full.json`，但仓库静态文件名为 `hero-splitfull.json`，该页面的收藏导入存在文件名不匹配。现有区块数据是静态快照，修改 Vue 组件不会自动更新快照。

收藏机制详见 [Collecty README](../../src/components/collecty/README.md)。

## Tailwind 与主题

Vue 应用使用 Tailwind CSS 4，而构建器仍使用 Tailwind 3 浏览器运行时。构建器外壳加载 `js/lib/tailwind.js`；生成的预览/导出页面还会引用 `https://cdn.tailwindcss.com`，因此相应页面依赖网络资源。

`src/components/theming/themeManager.ts` 将主题写入 `currentState.sceleton`：

- `config`：Tailwind 3 配置，颜色使用 `hsl(var(--token))`。
- `tailwindStyles`：来自 `themes.ts` 的 HSL 三元组变量。
- `theme`、`radius`：所选主题和圆角；字体写入 `config.theme.fontFamily.sans`。

更新客户端主题时要保留这套输出格式。应用 CSS 中供 Tailwind 4 使用的完整 `hsl(...)` / `oklch(...)` 值不能直接代替这里的 HSL 三元组。

## 目录与验证

```text
buildy/
├── index.html                # 构建器入口
├── editor.html               # 内容编辑器
├── css/                      # 静态样式
├── img/                      # 图片资源
└── js/
    ├── script.js             # 布局、持久化、导入/导出
    ├── classes.js            # 页面骨架与编辑功能
    ├── default.js            # 默认区块和页面配置
    ├── favourites-loader.js  # 从收藏读取静态区块
    ├── editor.js             # 独立编辑器逻辑
    └── lib/                  # 浏览器端依赖
```

`public/**` 不参与客户端 ESLint。修改后需在浏览器检查收藏导入、排序、编辑、主题、刷新恢复和 JSON/HTML 导出；`pnpm -C apps/client build` 会复制这些资源，但不会对其 JavaScript 做类型检查。BuildY 不使用 Vue 应用的国际化实例。

## 来源与许可

基于 HinddY / BuildY 的 Tailwind 页面构建器集成，许可见 [LICENSE](./LICENSE)。本目录没有上游说明中的 `flow.html` 或 `components/shadcn-uikit.json`，区块入口使用当前 Vue 展示页和 `public/api/pages/`。
