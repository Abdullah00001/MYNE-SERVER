import { container } from 'tsyringe'

import { LegalController } from '@/modules/legal/legal.controllers'
import { LegalMiddleware } from '@/modules/legal/legal.middlewares'
import { LegalService } from '@/modules/legal/legal.services'

export const registerLegalModule = (): void => {
  container.registerSingleton(LegalService)
  container.registerSingleton(LegalController)
  container.registerSingleton(LegalMiddleware)
}