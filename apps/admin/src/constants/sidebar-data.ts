import { BadgeHelpIcon, BellDotIcon, BirdIcon, BoxesIcon, BrainCircuitIcon, BugIcon, ComponentIcon, CreditCardIcon, KeyRoundIcon, LayoutDashboardIcon, ListTodoIcon, PaletteIcon, PictureInPicture2Icon, PodcastIcon, SettingsIcon, ShieldCheckIcon, SquareUserRoundIcon, UserCogIcon, UserIcon, UsersIcon } from '@lucide/vue'

import type { NavGroup, NavItem } from '@/components/app-sidebar/types'

type SidebarLink = Extract<NavItem, { url: string }>

// Titles are vue-i18n message keys (`src/plugins/i18n/*.json`), translated where they are rendered.

export const settingsNavItems: SidebarLink[] = [
  { title: 'nav.profile', url: '/settings/', icon: UserIcon },
  { title: 'nav.security', url: '/settings/account', icon: KeyRoundIcon },
  { title: 'nav.appearance', url: '/settings/appearance', icon: PaletteIcon },
  { title: 'nav.notifications', url: '/settings/notifications', icon: BellDotIcon },
  { title: 'nav.display', url: '/settings/display', icon: PictureInPicture2Icon },
]

export const navData: NavGroup[] = [
  {
    title: 'nav.groups.general',
    items: [
      { title: 'nav.dashboard', url: '/dashboard', icon: LayoutDashboardIcon },
      { title: 'nav.tasks', url: '/tasks', icon: ListTodoIcon },
      { title: 'nav.apps', url: '/apps', icon: BoxesIcon },
      { title: 'nav.aiTalk', url: '/ai-talk', icon: PodcastIcon },
    ],
  },
  {
    title: 'nav.groups.system',
    items: [
      { title: 'nav.users', url: '/users', icon: UsersIcon, permission: 'user:read' },
      { title: 'nav.admins', url: '/admins', icon: UserCogIcon, permission: 'admin:read' },
      { title: 'nav.roles', url: '/roles', icon: ShieldCheckIcon, permission: 'role:read' },
      { title: 'nav.embeddingModels', url: '/ai/embedding-models', icon: BrainCircuitIcon, permission: 'embedding-model:read' },
    ],
  },
  {
    title: 'nav.groups.pages',
    items: [
      {
        title: 'nav.auth',
        icon: SquareUserRoundIcon,
        items: [
          { title: 'nav.signIn', url: '/auth/sign-in' },
          { title: 'nav.signIn2', url: '/auth/sign-in-2' },
          { title: 'nav.forgotPassword', url: '/auth/forgot-password' },
          { title: 'nav.resetPassword', url: '/auth/reset-password' },
          { title: 'nav.otp', url: '/auth/otp' },
        ],
      },
      {
        title: 'nav.errors',
        icon: BugIcon,
        items: [
          { title: 'nav.error401', url: '/errors/401' },
          { title: 'nav.error403', url: '/errors/403' },
          { title: 'nav.error404', url: '/errors/404' },
          { title: 'nav.error500', url: '/errors/500' },
          { title: 'nav.error503', url: '/errors/503' },
        ],
      },
    ],
  },
  {
    title: 'nav.groups.other',
    items: [
      { title: 'nav.settings', items: settingsNavItems, icon: SettingsIcon },
      { title: 'nav.propComponents', url: '/prop-components', icon: ComponentIcon },
      { title: 'nav.helpCenter', url: '/help-center', icon: BadgeHelpIcon },
      { title: 'nav.github', url: 'https://www.github.com/Whbbit1999/shadcn-vue-admin', icon: BirdIcon },
    ],
  },
]

export const otherPages: NavGroup[] = [
  {
    title: 'nav.groups.other',
    items: [
      { title: 'nav.plansPricing', icon: CreditCardIcon, url: '/billing' },
    ],
  },
]
