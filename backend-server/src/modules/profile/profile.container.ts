import { container } from 'tsyringe'

import { ProfileController } from '@/modules/profile/profile.controllers'
import { ProfileMiddleware } from '@/modules/profile/profile.middlewares'
import { ProfileService } from '@/modules/profile/profile.services'

export const registerProfileModule = (): void => {
  container.registerSingleton(ProfileService)
  container.registerSingleton(ProfileController)
  container.registerSingleton(ProfileMiddleware)
}