import { Router } from 'express';
import { container } from 'tsyringe';

import { validateReqBody } from '@/middlewares/validateReqBody.middleware';
import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { ColorsController } from '@/modules/colors/colors.controllers';
import { ColorsMiddleware } from '@/modules/colors/colors.middlewares';
import { CreateColorsSchema } from '@/modules/colors/colors.schemas';

const router = Router();

const controller = container.resolve(ColorsController);
const middleware = container.resolve(ColorsMiddleware);
const authMiddleware = container.resolve(AuthMiddleware);

router
  .route('/colors')
  .get(authMiddleware.checkAccessToken, controller.getColors)
  .post(
    authMiddleware.checkAccessToken,
    validateReqBody(CreateColorsSchema),
    middleware.checkColorByName,
    controller.addColor
  );

export default router;
