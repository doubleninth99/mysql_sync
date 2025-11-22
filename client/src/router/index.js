import { createRouter, createWebHistory } from 'vue-router'
import ConnectionManager from '../views/ConnectionManager.vue'
import SyncWizard from '../views/SyncWizard.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'connections',
            component: ConnectionManager
        },
        {
            path: '/sync',
            name: 'sync',
            component: SyncWizard
        }
    ]
})

export default router
