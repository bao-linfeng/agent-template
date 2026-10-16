# `@repo/utils`

monorepo 共享工具函数库，框架无关，供 `apps/admin` 和 `apps/client` 共用。包直接导出 TypeScript 源码，无独立构建步骤。

## 使用方式

```ts
import { applyThemeClass, cn, createApiClient, FetchError, getErrorMessage, isExternalUrl, isUnauthorized } from '@repo/utils'
```

## 导出 API

### `cn(...inputs)`

合并 Tailwind CSS 类名，基于 `clsx` + `tailwind-merge`，处理条件类名和冲突覆盖。

```ts
cn('px-2 py-1', condition && 'bg-blue-500', 'px-4')
// → 'py-1 bg-blue-500 px-4'（px-4 覆盖 px-2）
```

### `isExternalUrl(url)`

判断 URL 是否为外部链接（以 `http://`、`https://` 或 `//` 开头）。

```ts
isExternalUrl('https://example.com') // → true
isExternalUrl('/about') // → false
```

### `applyThemeClass(theme, element?)`

将主题名应用到指定元素（默认为 `document.documentElement`）。移除所有已有的 `theme-*` class，再添加 `theme-${theme}`，保留 `dark` 等其他 class。传入不带 `theme-` 前缀的主题名；该函数需要 DOM。

```ts
applyThemeClass('blue') // 添加 theme-blue
applyThemeClass('green', document.body) // 在 body 上切换到 theme-green
```

### `createApiClient({ baseURL, authPath?, timeout?, onUnauthorized? })`

基于 ofetch 的 Cookie 会话客户端，对接 `apps/server`：默认带 `credentials: 'include'`，超时为 15 秒；遇到 401 时，同一客户端实例的并发请求共享一次 `POST <authPath>/refresh` 并各自重试一次；刷新失败或重试仍是 401 时调用并等待 `onUnauthorized`。

`baseURL` 指向账号体系（realm）的版本化根路径：客户端用户为 `<API>/v1/client`，管理端为 `<API>/v1/admin`。`authPath` 默认 `/auth`。该路径下 `login`、`register`、`refresh`、`logout`、`forgot-password`、`reset-password` 的 401 原样抛出，不触发刷新；匹配时忽略查询字符串。

返回 `{ fetch, refreshSession }`：`fetch` 使用相对接口路径，错误为 ofetch `FetchError`；`refreshSession()` 返回 `Promise<boolean>`，共享进行中的刷新请求，单独调用时不会触发 `onUnauthorized`。这是 Cookie 客户端，未实现服务端 Bearer 模式的令牌存储与轮换。

```ts
export const { fetch: api } = createApiClient({
  baseURL: 'http://localhost:3100/api/v1/client',
  onUnauthorized: () => { window.location.assign('/login') },
})
await api('/users/me', { method: 'PATCH', body: { nickname: 'Ada' } })
```

### `FetchError` / `isUnauthorized(error)` 与类型导出

`isUnauthorized` 仅在错误为 `FetchError` 且状态为 401 时返回 `true`。应用从本包导入它们，无需直接依赖 ofetch。另导出 `ApiClient`、`ApiClientOptions`、`ApiFetch` 和 `FetchOptions` 类型。

### `getErrorMessage(error, fallback?)`

把错误转成可读文案：拼接 Nest 校验错误数组 `message`，无响应时区分超时与无法连接，其余回退到 `statusText` / `Error.message` / `fallback`。

默认兜底为 `Request failed`；超时与连接失败消息是包内英文文本。传入翻译后的 `fallback` 不会覆盖服务端原始消息或这些网络错误文案。

## 开发

使用根目录的 Node.js 24+ / pnpm 11.25.0 环境安装依赖：`pnpm install --frozen-lockfile`。以下命令在仓库根目录运行：

```bash
pnpm -C packages/utils lint:fix
pnpm -C packages/utils check-types
pnpm -C packages/utils test
pnpm -C packages/utils test:watch
pnpm -C packages/utils test:coverage
```

修改此包后，admin 和 client 都需要验证：

```bash
pnpm -C apps/admin build
pnpm -C apps/client build
```

## 依赖

- `cn`：clsx + tailwind-merge 封装
- `ofetch`（catalog）：`createApiClient` 的传输层，admin/client 通过本包间接使用

## 测试

测试文件位于 `src/__tests__/`，使用 Vitest + happy-dom（需要 DOM 的用例通过 `// @vitest-environment happy-dom` 注释声明）。
