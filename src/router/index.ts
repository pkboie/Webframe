import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 頁面元件（示範）— 你已有 MapView，可直接用
import LocatedPage from '@/pages/Located.vue'
import PointsPage from '@/pages/PointsPage.vue'
import ExchangePage from '@/pages/ExchangePage.vue'
import RankPage from '@/pages/RankPage.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/located' },
  { path: '/located',  name: 'located',  component: LocatedPage,  meta: { idx: 0 } },
  { path: '/home',     name: 'home',     component: PointsPage,   meta: { idx: 1 } },
  { path: '/about',    name: 'about',    component: ExchangePage, meta: { idx: 2 } },
  { path: '/services', name: 'services', component: RankPage,     meta: { idx: 3 } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router