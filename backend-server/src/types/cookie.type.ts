type TCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax' | 'strict';
  path: string;
  domain?: string;
  maxAge?: number;
};

export default TCookieOptions;
