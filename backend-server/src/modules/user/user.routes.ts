import { Router } from 'express';
import { container } from 'tsyringe';

import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { UserController } from '@/modules/user/user.controllers';
import { UserMiddleware } from '@/modules/user/user.middlewares';
import {
  CreateUserSchema,
  getUsersRequestQueryParamsSchema,
} from '@/modules/user/user.schemas';
import { validateReqQuery } from '@/middlewares/validateReqQuery.middleware';

const router = Router();

const controller = container.resolve(UserController);
const middleware = container.resolve(UserMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

router
  .route('/admin/users')
  .post(
    authMiddleware.checkAdminAccessToken,
    validateReqBody(CreateUserSchema),
    authMiddleware.checkSignupUserExist,
    controller.createUser
  )
  .get(
    authMiddleware.checkAdminAccessToken,
    validateReqQuery(getUsersRequestQueryParamsSchema),
    controller.getUsers
  );

router
  .route('/admin/users/:id')
  .get(
    authMiddleware.checkAdminAccessToken,
    middleware.findUserById,
    controller.getSingleUser
  );

router
  .route('/admin/users/:id')
  .patch(
    authMiddleware.checkAdminAccessToken,
    middleware.findUserById,
    controller.changeUserAccountStatus
  );

export default router;
