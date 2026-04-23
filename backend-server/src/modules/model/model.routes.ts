import { Router } from 'express';
import { container } from 'tsyringe';

import {
  uploadSingle,
  handleMulterError,
  FieldConfig,
  uploadFields,
} from '@/middlewares/multer.middleware';
import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { ModelController } from '@/modules/model/model.controllers';
import { ModelMiddleware } from '@/modules/model/model.middlewares';
import {
  CreateModelSchema,
  UpdateModelSchema,
} from '@/modules/model/model.schemas';

const router = Router();

const controller = container.resolve(ModelController);
const middleware = container.resolve(ModelMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

const modelImageFields: FieldConfig[] = [
  { name: 'modelImage', maxCount: 1, optional: true },
];

router
  .route('/admin/model')
  .post(
    authMiddleware.checkAdminAccessToken,
    uploadSingle('modelImage'),
    handleMulterError,
    validateReqBody(CreateModelSchema),
    middleware.checkModelByName,
    controller.createModel
  )
  .get(authMiddleware.checkAdminAccessToken, controller.getModels);
router
  .route('/admin/model/search')
  .get(authMiddleware.checkAdminAccessToken, controller.searchModel);
router
  .route('/admin/model/:id')
  .put(
    authMiddleware.checkAdminAccessToken,
    middleware.findModelById,
    uploadFields(modelImageFields),
    handleMulterError,
    validateReqBody(UpdateModelSchema),
    controller.updateModelWithImage
  )
  .patch(
    authMiddleware.checkAdminAccessToken,
    middleware.findModelById,
    validateReqBody(UpdateModelSchema),
    controller.updateModelWithoutImage
  )
  .delete(
    authMiddleware.checkAdminAccessToken,
    middleware.findModelById,
    controller.deleteModel
  )
  .get(
    authMiddleware.checkAdminAccessToken,
    middleware.findModelById,
    controller.getSingleModel
  );

// user routes

router
  .route('/model')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.getModels
  )
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    validateReqBody(CreateModelSchema),
    controller.createModelByUser
  );

export default router;
