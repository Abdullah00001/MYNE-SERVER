import { container } from 'tsyringe'

import { AdminBagController } from '@/modules/adminBag/adminBag.controllers'
import { AdminBagMiddleware } from '@/modules/adminBag/adminBag.middlewares'
import { AdminBagService } from '@/modules/adminBag/adminBag.services'

export const registerAdminBagModule = (): void => {
  container.registerSingleton(AdminBagService)
  container.registerSingleton(AdminBagController)
  container.registerSingleton(AdminBagMiddleware)
}