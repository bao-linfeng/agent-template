import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Agent Template',
  description: 'pnpm + Turborepo 的 Vue 3 / NestJS 多应用模板文档',
  // Keep the build output in `dist/` so Turborepo caches it like the other apps
  outDir: './dist',
  srcExclude: ['README.md'],
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '共享包', link: '/guide/shared-packages' },
    ],
    sidebar: [
      {
        text: '指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '项目结构', link: '/guide/structure' },
          { text: '共享包', link: '/guide/shared-packages' },
          { text: '检查与测试', link: '/guide/verification' },
        ],
      },
    ],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
    search: { provider: 'local' },
  },
})
