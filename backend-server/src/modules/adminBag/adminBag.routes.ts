import { Router } from 'express';
import { container } from 'tsyringe';

import {
  handleMulterError,
  uploadSingle,
  uploadFields,
} from '@/middlewares/multer.middleware';
import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AdminBagController } from '@/modules/adminBag/adminBag.controllers';
import { AdminBagMiddleware } from '@/modules/adminBag/adminBag.middlewares';
import {
  createAdminBagSchema
} from '@/modules/adminBag/adminBag.schemas';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';

const router = Router();

const controller = container.resolve(AdminBagController);
const middleware = container.resolve(AdminBagMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

router
  .route('/admin/bags')
  .post(
    authMiddleware.checkAdminAccessToken,
    uploadSingle('bagImage'),
    handleMulterError,
    validateReqBody(createAdminBagSchema),
    controller.createAdminBag
)

// User Routes
router
  .route('/discover')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.getAdminBags
  );

router
  .route('/discover/:id')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findAdminBagById,
    controller.getOneAdminBag
  );

export default router;
