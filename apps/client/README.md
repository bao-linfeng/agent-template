# Vue Shadcn UIKit Starter

A Vue 3 + Shadcn UI starter for landing pages, multi-page applications, and reusable UI components. This copy is managed by the repository's pnpm workspace; Bun is only needed for the optional section collector script.

## 📦 NEW! Section Collector

This version adds an experimental feature to add sections to the builder.
Click on the drop down menu in the top right corner. Click `Get UI Blocks` and add the blocks you like to the site-wide collection. Then click `Go to BuildY` to go into the builder and see the blocks ready to build pages.
If you want to continue browsing the site without the collector functionality, just click: `Default State`.

## Page speed Google Lighthouse score 100%

[Google Lighthouse score](https://pagespeed.web.dev/analysis/https-vue-uikit-shadcn-vercel-app/b1ozhxmmsz?form_factor=desktop)

## 🚀 Getting Started

### Prerequisites

- Node.js >= 24 and pnpm 11.25.0 (root-pinned).
- Bun is optional: only `pnpm -C apps/client collect` requires it.

```bash
# From the repository root
pnpm install --frozen-lockfile
pnpm -C apps/client dev
pnpm -C apps/client check-types
pnpm -C apps/client build
```

The dev server uses port 5174 (strict). This package has no lint or test script. See the [root README](../../README.md) for workspace commands.

## 🎨 Component Development

### CVA (class-variance-authority) Approach

We use CVA for type-safe component variants. Here's how to create a new component:

```typescript
// components/ui/button/button.ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

### Component Implementation

```vue
<!-- components/ui/button/button.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { buttonVariants } from "./button";
import type { ButtonVariants } from "./button.types";

const props = defineProps<ButtonVariants>();

const classes = computed(() =>
  buttonVariants({ variant: props.variant, size: props.size }),
);
</script>

<template>
  <button :class="classes">
    <slot />
  </button>
</template>
```

## 🛠️ Tech Stack

- [Vue 3.5+](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Bun.js](https://bun.sh/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn-vue](https://github.com/unovue/shadcn-vue)
- [Radix Vue](https://www.radix-vue.com/)
- [class-variance-authority (CVA)](https://github.com/joe-bell/class-variance-authority)

## 📦 Project Structure

```
src/
├── components/
│   └── ui/          # Shadcn components
│       └── button/  # Example component structure
│           ├── button.ts        # CVA variants
│           ├── button.vue       # Component implementation
│           └── button.types.ts  # TypeScript interfaces
├── lib/
│   └── utils.ts     # Utility functions
├── styles/
│   └── globals.css  # Global styles
└── App.vue          # Main application
```

## 🔧 Development Guidelines

1. **Component Creation**:
   - Place new components in `src/components/ui/`
   - Use CVA for variant management
   - Create separate files for types and variants
   - Implement proper TypeScript interfaces

2. **Styling**:
   - Follow utility-first approach with Tailwind CSS
   - Use CVA for managing component variants
   - Maintain dark mode compatibility

3. **Type Safety**:
   - Ensure all components are properly typed
   - Use TypeScript strict mode
   - Leverage Vue 3.5+ type inference

## 🎯 Use Cases

- Landing Pages
- Marketing Websites
- Multi-page Applications
- Component Libraries
- Design Systems

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see the [MIT](LICENSE) file for details.

---

**Note**: This is an early preview of a larger ecosystem being developed for creating flexible, reusable UI components with shadcn-vue. Stay tuned for more blocks and components!

For more information, visit [shadcn-vue documentation](https://www.shadcn-vue.com/).
