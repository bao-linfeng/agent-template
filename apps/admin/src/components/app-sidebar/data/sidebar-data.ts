import { AudioWaveformIcon, CommandIcon, GalleryVerticalEndIcon } from '@lucide/vue'

import { navData } from '@/constants/sidebar-data'

import type { SidebarData, Team } from '../types'

const teams: Team[] = [
  {
    name: 'Acme Inc',
    logo: GalleryVerticalEndIcon,
    plan: 'Enterprise',
  },
  {
    name: 'Acme Corp.',
    logo: AudioWaveformIcon,
    plan: 'Startup',
  },
  {
    name: 'Evil Corp.',
    logo: CommandIcon,
    plan: 'Free',
  },
]

export const sidebarData: SidebarData = {
  teams,
  navMain: navData,
}
