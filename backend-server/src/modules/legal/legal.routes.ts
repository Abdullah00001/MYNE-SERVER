import { Router } from 'express';
import { container } from 'tsyringe';

import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { LegalController } from '@/modules/legal/legal.controllers';
import { LegalMiddleware } from '@/modules/legal/legal.middlewares';

const router = Router();

const controller = container.resolve(LegalController);
const authMiddleware = container.resolve(AuthMiddleware);
container.resolve(LegalMiddleware);

router
  .route('/admin/term-and-condition')
  .patch(
    authMiddleware.checkAdminAccessToken,
    controller.updateTermAndCondition
  );

router
  .route('/admin/privacy-and-policy')
  .patch(
    authMiddleware.checkAdminAccessToken,
    controller.updatePrivacyAndPolicy
  );

router.route('/privacy-and-policy').get(controller.getPrivacyAndPolicy);

router.route('/term-and-condition').get(controller.getTermAndCondition);

export default router;
