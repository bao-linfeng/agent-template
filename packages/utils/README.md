# `@repo/utils`

monorepo 共享工具函数库，框架无关，供 `apps/admin` 和 `apps/client` 共用。包直接导出 TypeScript 源码，无独立构建步骤。

## 使用方式

```ts
import { applyThemeClass, cn, createApiClient, getErrorMessage, isExternalUrl } from '@repo/utils'
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
isExternalUrl('/about')              // → false
```

### `applyThemeClass(theme, element?)`

将主题 class 应用到指定元素（默认为 `document.documentElement`）。移除所有已有的 `.theme-*` class，再添加新主题 class。

```ts
applyThemeClass('theme-blue')          // 切换到蓝色主题
applyThemeClass('', document.body)     // 清空 body 上的主题 class
```

### `createApiClient({ baseURL, timeout?, onUnauthorized? })`

基于 [ofetch](https://github.com/unjs/ofetch) 的 Cookie 会话客户端，对接 `apps/server`：所有请求带 `credentials: 'include'`；遇到 401 时，并发请求共享一次 `POST /auth/refresh` 并各自重试一次；刷新失败或重试仍是 401 时调用（并等待）`onUnauthorized`。登录、注册等凭证接口的 401 原样抛出，不触发刷新。返回 `{ fetch, refreshSession }`，错误为 ofetch 的 `FetchError`（同样从本包导出，另有 `isUnauthorized(error)`）。

```ts
export const { fetch: api } = createApiClient({
  baseURL: 'http://localhost:3100/api',
  onUnauthorized: () => router.push('/login'),
})
await api<UserProfile>('/users/me', { method: 'PATCH', body: { nickname: 'Ada' } })
```

### `getErrorMessage(error, fallback?)`

把错误转成可读文案：拼接 Nest 校验错误数组 `message`，无响应时区分超时与无法连接，其余回退到 `statusText` / `Error.message` / `fallback`。

## 开发

```bash
pnpm -C packages/utils lint:fix
pnpm -C packages/utils check-types
pnpm -C packages/utils test
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
