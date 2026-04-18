import { Router } from 'express';
import { container } from 'tsyringe';

import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AuthController } from '@/modules/auth/auth.controllers';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import {
  changePasswordSchema,
  findRecoverUserSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from '@/modules/auth/auth.schemas';

const router = Router();

const controller = container.resolve(AuthController);
const middleware = container.resolve(AuthMiddleware);

// User Signup Flow
router.post(
  '/auth/signup',
  validateReqBody(signupSchema),
  middleware.checkSignupUserExist,
  controller.signup
);

router.post(
  '/auth/verify',
  validateReqBody(verifyOtpSchema),
  middleware.checkOtpPageToken,
  middleware.checkOtp,
  controller.verifyOtp
);

router.post('/auth/resend', middleware.checkOtpPageToken, controller.resendOtp);

// User Login
router.post(
  '/auth/login',
  validateReqBody(loginSchema),
  middleware.findUserWithEmail,
  middleware.checkPassword,
  controller.login
);

router.patch(
  '/auth/change-password',
  middleware.checkAccessToken,
  middleware.checkUserAccountStatus,
  validateReqBody(changePasswordSchema),
  controller.changePassword
);

router.get(
  '/auth/check',
  middleware.checkAccessToken,
  middleware.checkUserAccountStatus,
  controller.checkAccessToken
);

router.post(
  '/auth/logout',
  middleware.checkAccessToken,
  middleware.checkUserAccountStatus,
  controller.logout
);

// Admin Login
router
  .route('/auth/admin/login')
  .post(
    validateReqBody(loginSchema),
    middleware.findUserWithEmail,
    middleware.checkPassword,
    controller.adminLogin
  );

router
  .route('/auth/admin/check')
  .get(middleware.checkAdminAccessToken, controller.checkAdminAccessToken);

router.post(
  '/auth/admin/refresh',
  middleware.checkAdminRefreshToken,
  controller.adminRefreshToken
);

router.post(
  '/auth/admin/logout',
  middleware.checkAdminAccessToken,
  controller.adminLogout
);

// Recover Flow
router.post(
  '/auth/recover/find',
  validateReqBody(findRecoverUserSchema),
  middleware.findUserWithEmail,
  controller.findRecoverUser
);

router.post(
  '/auth/recover/resend',
  middleware.checkOtpPageToken,
  controller.recoverUserOtpResend
);

router.post(
  '/auth/recover/verify',
  validateReqBody(verifyOtpSchema),
  middleware.checkOtpPageToken,
  middleware.checkOtp,
  controller.recoverUserOtpVerify
);

router.patch(
  '/auth/recover/reset',
  validateReqBody(resetPasswordSchema),
  middleware.checkOtpPageToken,
  controller.recoverResetPassword
);

export default router;
