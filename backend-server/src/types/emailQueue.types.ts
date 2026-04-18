export type TSignupUserVerifyOtpEmailData = {
  name: string;
  email: string;
  expirationTime: number;
  otp: string;
};

export type TRecoverAccountSuccessfulEmail = {
  name: string;
  email: string;
};
