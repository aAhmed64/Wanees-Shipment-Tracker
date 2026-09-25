import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'wanees-shipment-dashboard-iihm1k2i',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_NzcuD7w8L2kqIuxMNH7VghcrdyTGm6yq',
  authRequired: false,
  auth: { mode: 'managed' },
})
