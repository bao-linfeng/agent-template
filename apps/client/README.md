# Vue Shadcn UIKit Starter

A Vue 3 + shadcn-vue starter for landing pages: hero and blog sections, runtime theme switching, and a section collector that feeds the BuildY page builder. This copy is managed by the repository's pnpm workspace and shares its UI components and helpers with the admin app.

## Section Collector

Click the bookmark icon on a section to add it to the site-wide collection (stored in `localStorage.uiCollection`). Once the collection is not empty, a `BuildY` button appears in the navigation; it opens the builder in `public/buildy`, which reads the collection and the current theme.

## Getting Started

- Node.js >= 24 and pnpm 11.25.0 (root-pinned).

```bash
# From the repository root
pnpm install --frozen-lockfile
pnpm -C apps/client dev
pnpm -C apps/client lint:fix
pnpm -C apps/client test
pnpm -C apps/client build
```

The dev server uses port 5174 (strict). `build` runs `vue-tsc -b` before `vite build`. See the [root README](../../README.md) for workspace commands.

## Tech Stack

- [Vue 3.5](https://vuejs.org/), [Vue Router 5](https://router.vuejs.org/), [Vite 8](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/) via `@tailwindcss/vite`
- [shadcn-vue](https://www.shadcn-vue.com/) / [reka-ui](https://reka-ui.com/) components from `@repo/ui`
- [class-variance-authority](https://cva.style/) for section variants
- [`@lucide/vue`](https://lucide.dev/) icons
- Vitest + happy-dom, Antfu ESLint via `@repo/eslint-config`

## Project Structure

```
src/
├── assets/            # index.css (Tailwind entry + default tokens), glow effects
├── components/
│   ├── collecty/      # Section collector trigger/indicator
│   ├── darkMode/      # Dark mode toggle
│   ├── layers/        # Thin wrappers over @repo/ui components
│   ├── layout/        # Section / Container / Grid
│   ├── sections/      # hero, blog, navbar blocks
│   └── theming/       # Theme settings sheet, theme tokens, themeManager
├── composables/       # useCollecty, useFont
├── pages/             # Route components
└── router/            # Explicit route table
```

## Development Guidelines

- **Base UI**: import from `@repo/ui/components/<name>` and `cn` from `@repo/utils`. Don't copy shadcn components into this app; add them to `packages/ui` so the admin app can use them too.
- **Sections**: build blocks in `src/components/sections/` with CVA variants and a `class` prop merged through `cn`.
- **Theme tokens**: `src/assets/index.css` holds the defaults and `src/components/theming/themes.css` the `.theme-*` palettes. Values are full `hsl(...)` colors consumed by `@repo/ui/styles/theme.css`.
- **BuildY export**: `themeManager.ts` also writes a Tailwind 3 config and HSL-triplet styles (`themes.ts`) to `localStorage.currentState` for the BuildY builder, which still runs Tailwind 3 from a CDN. Keep that format when changing themes.
- **Icons**: navigation icons are mapped explicitly in `MainNavigation.vue`.

## License

MIT License - see the [MIT](LICENSE) file for details.
