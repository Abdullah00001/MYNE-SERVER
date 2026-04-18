import { Router } from 'express';
import { container } from 'tsyringe';

import { AuthMiddleware } from '@/modules/auth/auth.middlewares';
import { DashboardController } from '@/modules/dashboard/dashboard.controllers';
import { validateReqQuery } from '@/middlewares/validateReqQuery.middleware';
import { DashboardStatsQueryParamsSchema } from '@/modules/dashboard/dashboard.schemas';

const router = Router();

const controller = container.resolve(DashboardController);
const authMiddleware = container.resolve(AuthMiddleware);

router.route('/dashboard/stats').get(authMiddleware.checkAccessToken,authMiddleware.checkUserAccountStatus,controller.appDashboardStat);

router.get(
  '/admin/dashboard/stats',
  authMiddleware.checkAdminAccessToken,
  validateReqQuery(DashboardStatsQueryParamsSchema),
  controller.adminDashboardStat
);

export default router;
