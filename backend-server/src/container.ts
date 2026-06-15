import 'reflect-metadata';

// AUTO-IMPORTS (DO NOT REMOVE)
import { registerColorsModule } from '@/modules/colors/colors.container'
import { registerAdminBagModule } from '@/modules/adminBag/adminBag.container';
import { registerAuthModule } from '@/modules/auth/auth.container';
import { registerBlogModule } from '@/modules/blog/blog.container';
import { registerBrandModule } from '@/modules/brand/brand.container';
import { registerDashboardModule } from '@/modules/dashboard/dashboard.container';
import { registerImageModule } from '@/modules/image/image.container'
import { registerLegalModule } from '@/modules/legal/legal.container';
import { registerModelModule } from '@/modules/model/model.container';
import { registerProfileModule } from '@/modules/profile/profile.container';
import { registerUserModule } from '@/modules/user/user.container';
import { registerUserBagModule } from '@/modules/userBag/userBag.container';
import { registerWishlistModule } from '@/modules/wishlist/wishlist.container';
import { registerUtilsModule } from '@/utils/container';

export const registerContainers = (): void => {
  // AUTO-REGISTER (DO NOT REMOVE)
  registerUtilsModule();
  registerImageModule()
  registerDashboardModule();
  registerAdminBagModule();
  registerModelModule();
  registerUserModule();
  registerLegalModule();
  registerProfileModule();
  registerAuthModule();
  registerBlogModule();
  registerBrandModule();
  registerWishlistModule();
  registerUserBagModule();
  registerColorsModule()
};

export default registerContainers;
