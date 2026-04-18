import { container } from 'tsyringe'

import { UserController } from '@/modules/user/user.controllers'
import { UserMiddleware } from '@/modules/user/user.middlewares'
import { UserService } from '@/modules/user/user.services'

export const registerUserModule = (): void => {
  container.registerSingleton(UserService)
  container.registerSingleton(UserController)
  container.registerSingleton(UserMiddleware)
}