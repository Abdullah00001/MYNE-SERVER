import { JwtPayload } from 'jsonwebtoken';

import { FieldConfig } from '@/middlewares/multer.middleware';
import { IAdminBags } from '@/modules/adminBag/adminBag.types';
import { IUser } from '@/modules/auth/auth.types';
import { IBlog } from '@/modules/blog/blog.types';
import { IBrand } from '@/modules/brand/brand.types';
import { IModel } from '@/modules/model/model.types';
import { IUserBag } from '@/modules/userBag/userBag.types';
import { IWishlist } from '@/modules/wishlist/wishlist.types';

declare global {
  namespace Express {
    interface Request {
      fileLimit?: number;
      fieldName?: string;
      requireAtLeastOne?: boolean;
      allOptional?: boolean;
      fieldConfig?: FieldConfig[];
      files?: { [fieldname: string]: Express.Multer.File[] };
      user: JwtPayload | IUser;
      brand: IBrand;
      blog: IBlog;
      getUser: IUser;
      model: IModel;
      wish: IWishlist;
      adminBag: IUserBag;
      userBagCollection: IUserBag;
      validatedQuery?: unknown;
      isTempPasswordMatched: boolean;
    }
  }
}
