// queue/queues/email.queue.ts

import { injectable } from 'tsyringe';

import { BaseQueue } from '@/core/base_classes/queue.base';
import {
  TRecoverAccountSuccessfulEmail,
  TSignupUserVerifyOtpEmailData,
} from '@/types/emailQueue.types';

@injectable()
export class EmailQueue extends BaseQueue {
  constructor() {
    super('email-queue');
  }

  async sendSignupVerificationOtpEmail(
    data: TSignupUserVerifyOtpEmailData
  ): Promise<void> {
    await this.queue.add('send-signup-user-verify-otp-email', data);
  }

  async sendAccountRecoverVerificationOtpEmail(
    data: TSignupUserVerifyOtpEmailData
  ): Promise<void> {
    await this.queue.add('send-account-recover-otp-email', data);
  }

  async sendAccountRecoverSuccessfulEmail(
    data: TRecoverAccountSuccessfulEmail
  ): Promise<void> {
    await this.queue.add('send-account-recover-account-successful-email', data);
  }

  async sendSignupSuccessfulEmail(data: {
    name: string;
    email: string;
  }): Promise<void> {
    await this.queue.add('send-signup-successful-email', data);
  }

  async sendTemporaryPasswordToUserEmail(data: {
    name: string;
    email: string;
    password: string;
    passwordExpireAt: number;
    passwordExpireAtTimeUnit: 'hour' | 'hours' | 'day' | 'days';
  }): Promise<void> {
    await this.queue.add('send-temporary-password-email', data);
  }
}
