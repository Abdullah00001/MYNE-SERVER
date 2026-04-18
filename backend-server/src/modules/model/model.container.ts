import { container } from 'tsyringe'

import { ModelController } from '@/modules/model/model.controllers'
import { ModelMiddleware } from '@/modules/model/model.middlewares'
import { ModelService } from '@/modules/model/model.services'

export const registerModelModule = (): void => {
  container.registerSingleton(ModelService)
  container.registerSingleton(ModelController)
  container.registerSingleton(ModelMiddleware)
}