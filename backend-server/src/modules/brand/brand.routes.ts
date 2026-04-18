import { Router } from 'express';
import { container } from 'tsyringe';

import {
  uploadSingle,
  handleMulterError,
  FieldConfig,
  uploadFields,
} from '@/middlewares/multer.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { BrandController } from '@/modules/brand/brand.controllers';
import { BrandMiddleware } from '@/modules/brand/brand.middlewares';

const router = Router();

const authMiddleware = container.resolve(AuthMiddleware);

const controller = container.resolve(BrandController);
const brandMiddleware = container.resolve(BrandMiddleware);

const brandImageFields: FieldConfig[] = [
  { name: 'brandLogo', maxCount: 1, optional: true },
];

// User Routes
router
  .route('/brands')
  .get(
    authMiddleware.checkAccessToken,
    authMiddleware.checkUserAccountStatus,
    controller.getBrands
  );

router
  .route('/brands/search')
  .get(authMiddleware.checkAccessToken, controller.searchBrand);

// Admin Routes
router
  .route('/admin/brands')
  .post(
    authMiddleware.checkAdminAccessToken,
    uploadSingle('brandLogo'),
    handleMulterError,
    brandMiddleware.checkBrandByName,
    controller.createBrand
  )
  .get(authMiddleware.checkAdminAccessToken, controller.getBrands);

router
  .route('/admin/brands/search')
  .get(authMiddleware.checkAdminAccessToken, controller.searchBrand);

router
  .route('/admin/brands/:id')
  .put(
    authMiddleware.checkAdminAccessToken,
    brandMiddleware.findBrandById,
    uploadFields(brandImageFields),
    handleMulterError,
    controller.editBrandInfo
  )
  .patch(
    authMiddleware.checkAdminAccessToken,
    brandMiddleware.findBrandById,
    controller.editBrandName
  )
  .delete(
    authMiddleware.checkAdminAccessToken,
    brandMiddleware.findBrandById,
    controller.deleteBrand
  );

export default router;
