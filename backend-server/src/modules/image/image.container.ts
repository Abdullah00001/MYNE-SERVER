import { container } from 'tsyringe'

import { ImageController } from '@/modules/image/image.controllers'
import { ImageMiddleware } from '@/modules/image/image.middlewares'
import { ImageService } from '@/modules/image/image.services'

export const registerImageModule = (): void => {
  container.registerSingleton(ImageService)
  container.registerSingleton(ImageController)
  container.registerSingleton(ImageMiddleware)
}