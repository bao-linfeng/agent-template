import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useSession } from '@/composables/useSession'
import { onSessionExpired } from '@/lib/api'

declare module 'vue-router' {
  interface RouteMeta {
    /** Needs a signed-in user; guests are sent to /login?redirect=... */
    requiresAuth?: boolean
    /** Sign-in pages; signed-in users are sent to their account. */
    guestOnly?: boolean
    /** i18n message keys (see `src/i18n/locales`), translated where they are shown. */
    title?: string
    description?: string
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/Home.vue'),
    meta: {
      title: 'routes.home.title',
      icon: 'Home',
    },
  },
  {
    path: '/hero',
    name: 'Hero Sections',
    component: () => import('@/pages/Layout.vue'),
    meta: {
      title: 'routes.hero.title',
      description: 'routes.hero.description',
      isGroupParent: true,
    },
    children: [
      {
        path: 'base',
        name: 'Hero Base',
        component: () => import('@/pages/hero/Hero.vue'),
        meta: {
          icon: 'Layout',
          title: 'routes.heroBase.title',
          description: 'routes.heroBase.description',
        },
      },
      {
        path: 'media',
        name: 'Hero Media',
        component: () => import('@/pages/hero/Media.vue'),
        meta: {
          icon: 'Layout',
          title: 'routes.heroMedia.title',
          description: 'routes.heroMedia.description',
        },
      },
      {
        path: 'promo',
        name: 'Hero Promo',
        component: () => import('@/pages/hero/Promo.vue'),
        meta: {
          icon: 'Layout',
          title: 'routes.heroPromo.title',
          description: 'routes.heroPromo.description',
        },
      },
      {
        path: 'split',
        name: 'Hero Split',
        component: () => import('@/pages/hero/Split.vue'),
        meta: {
          icon: 'ChevronsRight',
          title: 'routes.heroSplit.title',
          description: 'routes.heroSplit.description',
        },
      },
      {
        path: 'split-full',
        name: 'Split Full',
        component: () => import('@/pages/hero/SplitFull.vue'),
        meta: {
          icon: 'ChevronsRight',
          title: 'routes.heroSplitFull.title',
          description: 'routes.heroSplitFull.description',
        },
      },
    ],
  },
  {
    path: '/blog',
    name: 'Blog Sections',
    component: () => import('@/pages/Layout.vue'),
    meta: {
      title: 'routes.blog.title',
      description: 'routes.blog.description',
      isGroupParent: true,
    },
    children: [
      {
        path: 'base',
        name: 'Blog Base',
        component: () => import('@/pages/blog/Grid.vue'),
        meta: {
          icon: 'Layout',
          title: 'routes.blogBase.title',
          description: 'routes.blogBase.description',
        },
      },
      {
        path: 'lists',
        name: 'Blog Lists',
        component: () => import('@/pages/blog/GridLists.vue'),
        meta: {
          icon: 'Layout',
          title: 'routes.blogLists.title',
          description: 'routes.blogLists.description',
        },
      },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/account/Login.vue'),
    meta: { title: 'routes.login.title', guestOnly: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/account/Register.vue'),
    meta: { title: 'routes.register.title', guestOnly: true },
  },
  {
    path: '/forgot-password',
    name: 'Forgot Password',
    component: () => import('@/pages/account/ForgotPassword.vue'),
    meta: { title: 'routes.forgotPassword.title' },
  },
  {
    // Target of the emailed reset link (`resetUrl` sent by ForgotPassword.vue).
    path: '/reset-password',
    name: 'Reset Password',
    component: () => import('@/pages/account/ResetPassword.vue'),
    meta: { title: 'routes.resetPassword.title' },
  },
  {
    path: '/account',
    name: 'Account',
    component: () => import('@/pages/account/Account.vue'),
    meta: { title: 'routes.account.title', requiresAuth: true },
  },
  {
    path: '/buildy/:pathMatch(.*)*',
    name: 'Buildy',
    component: () => import('@/pages/Layout.vue'),
    beforeEnter: () => {
      window.location.href = '/buildy/index.html'
    },
  },
  {
    path: '/reset/:pathMatch(.*)*',
    name: 'Reset',
    component: () => import('@/pages/Layout.vue'),
    beforeEnter: () => {
      window.location.href = '/'
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/Layout.vue'),
    beforeEnter: () => ({ path: '/' }),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0, behavior: 'smooth' }
  },
})

/** Where to send a navigation, given the session state (`undefined` lets it through). */
export function resolveAccessRedirect(to: Pick<RouteLocationNormalized, 'fullPath' | 'meta'>, isLoggedIn: boolean) {
  if (to.meta.requiresAuth && !isLoggedIn)
    return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && isLoggedIn)
    return { path: '/account' }
}

router.beforeEach(async (to) => {
  const session = useSession()
  if (!session.initialized.value) {
    const restoring = session.restore()
    // Public pages render right away; the navbar updates once the session is known.
    if (!to.meta.requiresAuth && !to.meta.guestOnly)
      return
    await restoring
  }
  return resolveAccessRedirect(to, session.isLoggedIn.value)
})

// An expired session on a protected page goes back to sign-in.
onSessionExpired(() => {
  const current = router.currentRoute.value
  if (current.meta.requiresAuth)
    router.replace({ path: '/login', query: { redirect: current.fullPath } })
})

export default router
