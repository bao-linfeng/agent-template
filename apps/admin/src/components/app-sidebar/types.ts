import type { LucideProps } from '@lucide/vue'
import type { FunctionalComponent } from 'vue'

type NavIcon = FunctionalComponent<LucideProps, Record<any, any>, any, Record<any, any>>

interface BaseNavItem {
  /** vue-i18n message key, e.g. `nav.users`; also identifies the entry in the nav path. */
  title: string
  icon?: NavIcon
  /** Permission code required to see the entry (hidden otherwise), e.g. `user:read`. */
  permission?: string
}

export type NavItem
  = | BaseNavItem & {
    items: NavSubItem[]
    url?: never
    isActive?: boolean
  } | BaseNavItem & {
    url: string
    items?: never
  }

/**
 * A navigation entry as exposed by `useSidebarNavigation()`.
 * Covers top-level items and nested sub-items (whose `url` is optional).
 */
export type NavSubItem = BaseNavItem & {
  url?: string
  items?: NavSubItem[]
  isActive?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export interface User {
  name: string
  avatar: string | null
  email: string
}

export interface Team {
  name: string
  logo: NavIcon
  plan: string
}

export interface SidebarData {
  teams: Team[]
  navMain: NavGroup[]
}
