import { JwtPayload } from 'jsonwebtoken';

import { AccountStatus } from '@/modules/auth/auth.types';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

export interface ITokenPayload extends JwtPayload {
  sub: string;
  rememberMe?: boolean;
  role: Role;
  isVerified: boolean;
  accountStatus: AccountStatus;
}
