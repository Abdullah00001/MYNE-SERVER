import { Router } from 'express';
import { container } from 'tsyringe';

import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { WishlistController } from '@/modules/wishlist/wishlist.controllers';
import { WishlistMiddleware } from '@/modules/wishlist/wishlist.middlewares';
import {
  CreateWishSchema,
  UpdateWishSchema,
} from '@/modules/wishlist/wishlist.schemas';

const router = Router();

const controller = container.resolve(WishlistController);
const middleware = container.resolve(WishlistMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

router
  .route('/wishlists')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    validateReqBody(CreateWishSchema),
    controller.createWish
  )
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.getWishes
  );

router
  .route('/wishlists/:id')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findWishById,
    controller.getOneWish
  )
  .put(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findWishById,
    validateReqBody(UpdateWishSchema),
    controller.changeWishStatus
  )
  .delete(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findWishById,
    controller.deleteWish
  );

export default router;
