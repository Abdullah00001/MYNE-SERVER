import { container } from 'tsyringe'

import { BrandController } from '@/modules/brand/brand.controllers'
import { BrandMiddleware } from '@/modules/brand/brand.middlewares'
import { BrandService } from '@/modules/brand/brand.services'

export const registerBrandModule = (): void => {
  container.registerSingleton(BrandService)
  container.registerSingleton(BrandController)
  container.registerSingleton(BrandMiddleware)
}