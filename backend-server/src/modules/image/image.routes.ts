import { Router } from 'express';
import { container } from 'tsyringe';

import {
  handleMulterError,
  uploadSingle,
} from '@/middlewares/multer.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { ImageController } from '@/modules/image/image.controllers';
import { ImageMiddleware } from '@/modules/image/image.middlewares';

const router = Router();

const controller = container.resolve(ImageController);
container.resolve(ImageMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

router
  .route('/image')
  .post(
    authMiddleware.checkAccessToken,
    uploadSingle('image'),
    handleMulterError,
    controller.uploadImage
  )
  .delete(authMiddleware.checkAccessToken, controller.deleteImage);

  

export default router;
