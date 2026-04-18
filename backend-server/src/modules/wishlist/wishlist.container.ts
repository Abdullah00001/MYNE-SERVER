import { container } from 'tsyringe'

import { WishlistController } from '@/modules/wishlist/wishlist.controllers'
import { WishlistMiddleware } from '@/modules/wishlist/wishlist.middlewares'
import { WishlistService } from '@/modules/wishlist/wishlist.services'

export const registerWishlistModule = (): void => {
  container.registerSingleton(WishlistService)
  container.registerSingleton(WishlistController)
  container.registerSingleton(WishlistMiddleware)
}