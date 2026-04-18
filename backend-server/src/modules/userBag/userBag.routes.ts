import { Router } from 'express';
import { container } from 'tsyringe';

import {
  uploadFields,
  handleMulterError,
  FieldConfig,
  uploadSingle,
  uploadArray,
} from '@/middlewares/multer.middleware';
import {
  createCollectionRequestBodyValidationMiddleware,
  validateReqBody,
} from '@/middlewares/validateReqBody.middleware';
import { validateReqQuery } from '@/middlewares/validateReqQuery.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { UserBagController } from '@/modules/userBag/userBag.controllers';
import { UserBagMiddleware } from '@/modules/userBag/userBag.middlewares';
import {
  CreateCollectionSchema,
  CollectionQuerySchema,
  PutCollectionSchema,
  PatchUserCollectionSchema,
  createBagStepOneSchema,
  createBagStepTwoSchema,
  createBagStepThreeSchema,
  createBagStepFourSchema,
} from '@/modules/userBag/userBag.schemas';

const router = Router();

const controller = container.resolve(UserBagController);
const middleware = container.resolve(UserBagMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

// USer Routes
const createCollectionImageFields: FieldConfig[] = [
  { name: 'images', maxCount: 9, optional: false },
  { name: 'primaryImage', maxCount: 1, optional: false },
  { name: 'receiptImage', maxCount: 1, optional: true },
];

const updateCollectionImageFields: FieldConfig[] = [
  { name: 'images', maxCount: 9, optional: true },
  { name: 'primaryImage', maxCount: 1, optional: true },
  { name: 'receiptImage', maxCount: 1, optional: true },
];

const manualBagCreationStepFourImageFields: FieldConfig[] = [
  { name: 'receiptImage', maxCount: 1, optional: true },
];

router
  .route('/collections/image')
  .patch(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    uploadSingle('collection_image'),
    controller.uploadCollectionSingleImage
  )
  .put(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    uploadArray('collection_images', 10),
    controller.uploadCollectionMultipleImages
  );

router
  .route('/collections')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    uploadFields(createCollectionImageFields),
    handleMulterError,
    createCollectionRequestBodyValidationMiddleware(CreateCollectionSchema),
    controller.createCollection
  )
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    validateReqQuery(CollectionQuerySchema),
    controller.getUserCollection
  );

/**
 * =======================================================
 * Manual Bag Collection Creation
 * =======================================================
 * */

router
  .route('/collections/checkBrandModel')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.checkBrandModel
  );

router
  .route('/collections/step_one')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    validateReqBody(createBagStepOneSchema),
    controller.createCollectionStepOne
  );

router
  .route('/collections/step_one/:id')
  .put(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    validateReqBody(createBagStepOneSchema),
    controller.createCollectionStepOneUpdate
  );

router
  .route('/collections/step_two/:id')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    validateReqBody(createBagStepTwoSchema),
    controller.createCollectionStepTwo
  );

router
  .route('/collections/step_three/:id')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    validateReqBody(createBagStepThreeSchema),
    controller.createCollectionStepThree
  );

router
  .route('/collections/step_four/:id')
  .post(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    uploadFields(manualBagCreationStepFourImageFields),
    validateReqBody(createBagStepFourSchema),
    controller.createCollectionStepFour
  );

router
  .route('/collections/currentPrice/:id')
  .patch(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    controller.changeCollectionCurrentPrice
  );

router
  .route('/collections/:id')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    controller.getCollectionById
  )
  .put(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    uploadFields(updateCollectionImageFields, true),
    handleMulterError,
    validateReqBody(PutCollectionSchema),
    controller.updateCollection
  )
  .patch(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    validateReqBody(PatchUserCollectionSchema),
    controller.patchCollection
  )
  .delete(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    middleware.findBagCollectionById,
    controller.deleteCollection
  );

router
  .route('/admin/collections')
  .get(
    authMiddleware.checkAdminAccessToken,
    validateReqQuery(CollectionQuerySchema),
    controller.getAllCollectionForAdmin
  );

router
  .route('/admin/collections/:id')
  .get(
    authMiddleware.checkAdminAccessToken,
    middleware.findBagCollectionById,
    controller.getCollectionById
  )
  .delete(
    authMiddleware.checkAdminAccessToken,
    middleware.findBagCollectionById,
    controller.deleteOneCollectionByAdmin
  );

export default router;
