# Collecty 区块收藏

客户端的区块收藏 UI，配合 `src/composables/useCollecty.ts` 将区块标识与来源路径保存在浏览器中，供 [BuildY](../../../public/buildy/README.md) 导入静态 HTML 区块。收藏不依赖登录，也不会上传到服务端。

## 组成

| 文件                               | 职责                                                                |
| ---------------------------------- | ------------------------------------------------------------------- |
| `Collecty.vue`                     | 提供相对定位的容器与默认插槽，支持 `class`                          |
| `CollectyTrigger.vue`              | 书签按钮，从 `section-data` 注入当前收藏状态和切换动作              |
| `CollectyIndicator.vue`            | 已收藏时显示圆点，同样读取 `section-data`                           |
| `index.ts`                         | 导出组件与 CVA 样式；按钮支持 `default/solid/outline` 和 `sm/md/lg` |
| `../../composables/useCollecty.ts` | 模块级共享收藏状态、初始化、去重和持久化                            |

实际 provider 在 `src/components/sections/hero/Hero.vue`。`Collecty` 容器本身不提供状态；脱离 provider 单独放置按钮时，点击不会改变收藏。

## 使用

Hero 已经内置收藏按钮，传入稳定且与静态区块数据对应的 `sectionKey` 即可：

```vue
<script setup lang="ts">
import Hero from '@/components/sections/hero/Hero.vue'
</script>

<template>
  <Hero section-key="example">
    <h1>Example section</h1>
  </Hero>
</template>
```

其他区块要接入时，按 `src/types/collecty.ts` 的 `SectionData` 提供 `section-data`，包含 `id`、`isInCollection` 和 `toggleCollection`，再放入 `CollectyTrigger` / `CollectyIndicator`。按钮图标标签通过 vue-i18n 的 `collecty.add`、`collecty.remove` 翻译。

## 状态与存储格式

```ts
const { collection, isInCollection, addToCollection, removeFromCollection } = useCollecty()

addToCollection('hero__example', '/hero/base')
isInCollection('hero__example') // true
removeFromCollection('hero__example')
```

- `collection` 是 computed，所有调用方共享同一份模块级状态。
- 首次调用从 `localStorage.uiCollection` 恢复，使用一个独立 effect scope 中的深度 watcher 持久化，组件卸载不会停止它。
- 添加时去掉 `hero__` 前缀，拼接随机后缀；按基础 ID 去重，不是按页面路径去重。
- 删除时移除同一基础 ID 的收藏。空 ID/路径不会被添加；无法解析的存储数据会回退为空集合。
- 当前没有跨标签页 `storage` 事件同步，也没有服务端持久化。

存储内容是数组，例如：

```json
[
  {
    "id": "example_a1b2",
    "path": "/hero/base",
    "timestamp": 1760000000000
  }
]
```

这里保存的是区块引用，不是当前 DOM 的 HTML。BuildY 将 `/hero/base` 转为 `/api/pages/hero-base.json`，去掉随机后缀后匹配静态区块 ID。新增可收藏区块时，需要同步 `public/api/pages/` 中对应的 JSON；仅添加 Vue 区块不会自动生成这些数据。

## 验证

从仓库根目录运行已有收藏状态测试：

```sh
pnpm -C apps/client test src/composables/__tests__/useCollecty.test.ts
```

手动检查：收藏 Hero → 刷新后仍显示已收藏 → 导航栏进入 BuildY → 点击 `Get UI Blocks` → 确认静态区块导入。取消收藏只更新收藏列表，BuildY 的 `currentState` 是另一份持久化状态。
