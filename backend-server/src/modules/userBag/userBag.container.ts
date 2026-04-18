import { container } from 'tsyringe'

import { UserBagController } from '@/modules/userBag/userBag.controllers'
import { UserBagMiddleware } from '@/modules/userBag/userBag.middlewares'
import { UserBagService } from '@/modules/userBag/userBag.services'

export const registerUserBagModule = (): void => {
  container.registerSingleton(UserBagService)
  container.registerSingleton(UserBagController)
  container.registerSingleton(UserBagMiddleware)
}