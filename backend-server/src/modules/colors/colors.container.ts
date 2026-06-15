import { container } from 'tsyringe'

import { ColorsController } from '@/modules/colors/colors.controllers'
import { ColorsMiddleware } from '@/modules/colors/colors.middlewares'
import { ColorsService } from '@/modules/colors/colors.services'

export const registerColorsModule = (): void => {
  container.registerSingleton(ColorsService)
  container.registerSingleton(ColorsController)
  container.registerSingleton(ColorsMiddleware)
}