import { container } from 'tsyringe'

import { BlogController } from '@/modules/blog/blog.controllers'
import { BlogMiddleware } from '@/modules/blog/blog.middlewares'
import { BlogService } from '@/modules/blog/blog.services'

export const registerBlogModule = (): void => {
  container.registerSingleton(BlogService)
  container.registerSingleton(BlogController)
  container.registerSingleton(BlogMiddleware)
}