import { Router } from 'express';

import AdminBagRoutes from '@/modules/adminBag/adminBag.routes';
import AuthRoutes from '@/modules/auth/auth.routes';
import BlogRoutes from '@/modules/blog/blog.routes';
import BrandRoutes from '@/modules/brand/brand.routes';
import DashboardRoutes from '@/modules/dashboard/dashboard.routes';
import ImageRoutes from '@/modules/image/image.routes'
import LegalRoutes from '@/modules/legal/legal.routes';
import ModelRoutes from '@/modules/model/model.routes';
import ProfileRoutes from '@/modules/profile/profile.routes';
import UserRoutes from '@/modules/user/user.routes';
import UserBagRoutes from '@/modules/userBag/userBag.routes';
import WishlistRoutes from '@/modules/wishlist/wishlist.routes';

const routes: Router[] = [
  AuthRoutes,
  ProfileRoutes,
  BrandRoutes,
  BlogRoutes,
  LegalRoutes,
  UserRoutes,
  ModelRoutes,
  AdminBagRoutes,
  WishlistRoutes,
  UserBagRoutes,
  DashboardRoutes,
  ImageRoutes,
];

const v1Routes = Router();

routes.forEach((route) => v1Routes.use(route));

export default v1Routes;
