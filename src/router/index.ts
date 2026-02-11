import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'subgraphs',
      component: () => import('@/views/SubgraphsDashboard.vue'),
    },
    {
      path: '/allocations',
      name: 'allocations',
      component: () => import('@/views/AllocationsDashboard.vue'),
    },
    {
      path: '/wizard',
      name: 'wizard',
      component: () => import('@/views/AllocationWizard.vue'),
    },
    {
      path: '/actions',
      name: 'actions',
      component: () => import('@/views/ActionsManager.vue'),
    },
    {
      path: '/offchain',
      name: 'offchain',
      component: () => import('@/views/OffchainSyncManager.vue'),
    },
    {
      path: '/qos',
      name: 'qos',
      component: () => import('@/views/QosDashboard.vue'),
    },
    {
      path: '/query',
      name: 'query',
      component: () => import('@/views/QueryDashboard.vue'),
    },
    {
      path: '/status',
      name: 'status',
      component: () => import('@/views/DeploymentStatusDashboard.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
    },
  ],
})

export default router
