import { BadgeHelpIcon, BellDotIcon, BirdIcon, BoxesIcon, BrainCircuitIcon, BugIcon, ComponentIcon, CreditCardIcon, KeyRoundIcon, LayoutDashboardIcon, ListTodoIcon, PaletteIcon, PictureInPicture2Icon, PodcastIcon, SettingsIcon, ShieldCheckIcon, SquareUserRoundIcon, UserIcon, UsersIcon } from '@lucide/vue'

import type { NavGroup, NavItem } from '@/components/app-sidebar/types'

type SidebarLink = Extract<NavItem, { url: string }>

export const settingsNavItems: SidebarLink[] = [
  { title: 'Profile', url: '/settings/', icon: UserIcon },
  { title: 'Security', url: '/settings/account', icon: KeyRoundIcon },
  { title: 'Appearance', url: '/settings/appearance', icon: PaletteIcon },
  { title: 'Notifications', url: '/settings/notifications', icon: BellDotIcon },
  { title: 'Display', url: '/settings/display', icon: PictureInPicture2Icon },
]

export const navData: NavGroup[] = [
  {
    title: 'General',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboardIcon },
      { title: 'Tasks', url: '/tasks', icon: ListTodoIcon },
      { title: 'Apps', url: '/apps', icon: BoxesIcon },
      { title: 'Ai Talk Example', url: '/ai-talk', icon: PodcastIcon },
    ],
  },
  {
    title: 'System',
    items: [
      { title: 'Users', url: '/users', icon: UsersIcon, permission: 'user:read' },
      { title: 'Roles', url: '/roles', icon: ShieldCheckIcon, permission: 'role:read' },
      { title: 'Embedding Models', url: '/ai/embedding-models', icon: BrainCircuitIcon, permission: 'embedding-model:read' },
    ],
  },
  {
    title: 'Pages',
    items: [
      {
        title: 'Auth',
        icon: SquareUserRoundIcon,
        items: [
          { title: 'Sign In', url: '/auth/sign-in' },
          { title: 'Sign In(2 Col)', url: '/auth/sign-in-2' },
          { title: 'Sign Up', url: '/auth/sign-up' },
          { title: 'Forgot Password', url: '/auth/forgot-password' },
          { title: 'Reset Password', url: '/auth/reset-password' },
          { title: 'OTP', url: '/auth/otp' },
        ],
      },
      {
        title: 'Errors',
        icon: BugIcon,
        items: [
          { title: '401 | Unauthorized', url: '/errors/401' },
          { title: '403 | Forbidden', url: '/errors/403' },
          { title: '404 | Not Found', url: '/errors/404' },
          { title: '500 | Internal Server Error', url: '/errors/500' },
          { title: '503 | Maintenance Error', url: '/errors/503' },
        ],
      },
    ],
  },
  {
    title: 'Other',
    items: [
      { title: 'Settings', items: settingsNavItems, icon: SettingsIcon },
      { title: 'Prop Components', url: '/prop-components', icon: ComponentIcon },
      { title: 'Help Center', url: '/help-center', icon: BadgeHelpIcon },
      { title: 'Outside Page(GitHub)', url: 'https://www.github.com/Whbbit1999/shadcn-vue-admin', icon: BirdIcon },
    ],
  },
]

export const otherPages: NavGroup[] = [
  {
    title: 'Other',
    items: [
      { title: 'Plans & Pricing', icon: CreditCardIcon, url: '/billing' },
    ],
  },
]
