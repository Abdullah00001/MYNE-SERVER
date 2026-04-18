import { Router } from 'express';
import { container } from 'tsyringe';

import {
  uploadSingle,
  handleMulterError,
} from '@/middlewares/multer.middleware';
import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { ProfileController } from '@/modules/profile/profile.controllers';
import { ProfileMiddleware } from '@/modules/profile/profile.middlewares';
import {
  changePasswordSchema,
  updateUserProfileInfoSchema,
} from '@/modules/profile/profile.schemas';

const router = Router();

const controller = container.resolve(ProfileController);
const middleware = container.resolve(ProfileMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

// User Routes
router.post(
  '/profile/avatar',
  authMiddleware.checkAccessToken,
  authMiddleware.checkUserAccountStatus,
  uploadSingle('avatar'),
  handleMulterError,
  controller.uploadAvatar
);

router.delete(
  '/profile/avatar',
  authMiddleware.checkAccessToken,
  authMiddleware.checkUserAccountStatus,
  controller.deleteAvatar
);

router
  .route('/profile/password')
  .patch(
    validateReqBody(changePasswordSchema),
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.checkCurrentPassword,
    controller.changePassword
  );

router
  .route('/profile')
  .put(
    validateReqBody(updateUserProfileInfoSchema),
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.changeProfileInfo
  );

router
  .route('/profile')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.getProfileInfo
  );

// Admin Routes

router.post(
  '/admin/profile/avatar',
  authMiddleware.checkAdminAccessToken,
  authMiddleware.checkUserAccountStatus,
  uploadSingle('avatar'),
  handleMulterError,
  controller.uploadAvatar
);

router.delete(
  '/admin/profile/avatar',
  authMiddleware.checkAdminAccessToken,
  authMiddleware.checkUserAccountStatus,
  controller.deleteAvatar
);

router
  .route('/admin/profile/password')
  .patch(
    validateReqBody(changePasswordSchema),
    authMiddleware.checkAdminAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.checkCurrentPassword,
    controller.changePassword
  );

router
  .route('/admin/profile')
  .put(
    validateReqBody(updateUserProfileInfoSchema),
    authMiddleware.checkAdminAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.changeProfileInfo
  );

router
  .route('/admin/profile')
  .get(
    authMiddleware.checkAdminAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.getProfileInfo
  );

export default router;
