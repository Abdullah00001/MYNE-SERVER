import { container } from 'tsyringe'

import { AuthController } from '@/modules/auth/auth.controllers'
import { AuthMiddleware } from '@/modules/auth/auth.middlewares'
import { AuthService } from '@/modules/auth/auth.services'

export const registerAuthModule = (): void => {
  container.registerSingleton(AuthService)
  container.registerSingleton(AuthController)
  container.registerSingleton(AuthMiddleware)
}