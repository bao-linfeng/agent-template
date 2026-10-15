# Docs

仓库文档站，基于 [VitePress](https://vitepress.dev/)。页面是本目录下的 Markdown（`index.md`、`guide/*.md`），站点配置在 `.vitepress/config.ts`。本 README 不会作为页面发布。

```sh
pnpm -C apps/docs dev          # http://localhost:3001
pnpm -C apps/docs lint:fix
pnpm -C apps/docs check-types
pnpm -C apps/docs build        # 输出到 apps/docs/dist
pnpm -C apps/docs preview
```
