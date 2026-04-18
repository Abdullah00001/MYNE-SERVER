import Handlebars from 'handlebars';
import { injectable } from 'tsyringe';

import mailTransporter from '@/configs/nodemailer.config';
import { passwordResetSuccessEmailTemplate } from '@/templates/passwordResetSuccessEmail.template';
import { recoverUserOtpEmailTemplate } from '@/templates/recoverUserOtpEmail.template';
import { signupSuccessfulEmailTemplate } from '@/templates/signupSuccessfulEmail.template';
import { signupUserVerifyOtpEmailTemplate } from '@/templates/signupUserVerifyOtpEmail.template';
import { tempPasswordEmailTemplate } from '@/templates/tempPasswordEmail.template';
import {
  TRecoverAccountSuccessfulEmail,
  TSignupUserVerifyOtpEmailData,
} from '@/types/emailQueue.types';
import mailOption from '@/utils/mailOption.utils';

@injectable()
export class SendEmail {
  async sendSignupUserVerifyOtpEmail(
    data: TSignupUserVerifyOtpEmailData
  ): Promise<void> {
    try {
      const template = Handlebars.compile(signupUserVerifyOtpEmailTemplate);
      const personalizedTemplate = template(data);
      await mailTransporter.sendMail(
        mailOption(
          data.email,
          'Email Verification Required',
          personalizedTemplate
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(
          'Unknown Error Occurred In Send Account Verification Otp Email Utility'
        );
      }
    }
  }
  async sendAccountVerificationSuccessEmail(): Promise<void> {}
  async sendRecoverAccountOtpEmail(
    data: TSignupUserVerifyOtpEmailData
  ): Promise<void> {
    try {
      const template = Handlebars.compile(recoverUserOtpEmailTemplate);
      const personalizedTemplate = template(data);
      await mailTransporter.sendMail(
        mailOption(
          data.email,
          'Email Verification Required',
          personalizedTemplate
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(
          'Unknown Error Occurred In Send Account Recover Verification Otp Email Utility'
        );
      }
    }
  }

  async sendRecoverAccountSuccessEmail({
    email,
    name,
  }: TRecoverAccountSuccessfulEmail): Promise<void> {
    try {
      const template = Handlebars.compile(passwordResetSuccessEmailTemplate);
      const personalizedTemplate = template({ email, name });
      await mailTransporter.sendMail(
        mailOption(email, 'Account Recover Successful', personalizedTemplate)
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(
          'Unknown Error Occurred In Send Account Recover Successful Email Utility'
        );
      }
    }
  }

  async sendSignupSuccessEmail({
    email,
    name,
  }: {
    email: string;
    name: string;
  }): Promise<void> {
    try {
      const template = Handlebars.compile(signupSuccessfulEmailTemplate);
      const personalizedTemplate = template({ email, name });
      await mailTransporter.sendMail(
        mailOption(email, 'Signup Successful', personalizedTemplate)
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(
          'Unknown Error Occurred In Send Signup Successful Email Utility'
        );
      }
    }
  }

  async sendTemporaryPasswordToUserEmail({
    email,
    name,
    password,
    passwordExpireAt,
    passwordExpireAtTimeUnit,
  }: {
    name: string;
    email: string;
    password: string;
    passwordExpireAt: number;
    passwordExpireAtTimeUnit: 'hour' | 'hours' | 'day' | 'days';
  }): Promise<void> {
    try {
      const template = Handlebars.compile(tempPasswordEmailTemplate);
      const personalizedTemplate = template({
        email,
        name,
        password,
        passwordExpireAt,
        passwordExpireAtTimeUnit,
      });
      await mailTransporter.sendMail(
        mailOption(
          email,
          'Your Temporary Password – Action Required',
          personalizedTemplate
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(
          'Unknown Error Occurred In Send Temporary Password Email to User Utility'
        );
      }
    }
  }
}
