// queue/workers/email.worker.ts
import { Job } from 'bullmq';
import { injectable } from 'tsyringe';

import { BaseWorker } from '@/core/base_classes/worker.base';
import {
  TRecoverAccountSuccessfulEmail,
  TSignupUserVerifyOtpEmailData,
} from '@/types/emailQueue.types';
import { SendEmail } from '@/utils/sendEmail.utils';

@injectable()
export class EmailWorker extends BaseWorker {
  constructor(private readonly sendEmail: SendEmail) {
    super('email-queue', async (job: Job) => {
      await this.process(job);
    });
  }

  private async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'send-signup-user-verify-otp-email':
        await this.sendEmail.sendSignupUserVerifyOtpEmail(
          job.data as TSignupUserVerifyOtpEmailData
        );
        return;
      case 'send-account-recover-otp-email':
        await this.sendEmail.sendRecoverAccountOtpEmail(
          job.data as TSignupUserVerifyOtpEmailData
        );
        return;
      case 'send-account-recover-account-successful-email':
        await this.sendEmail.sendRecoverAccountSuccessEmail(
          job.data as TRecoverAccountSuccessfulEmail
        );
        return;
      case 'send-signup-successful-email':
        await this.sendEmail.sendSignupSuccessEmail(
          job.data as { name: string; email: string }
        );
        return;
      case 'send-temporary-password-email':
        await this.sendEmail.sendTemporaryPasswordToUserEmail(
          job.data as {
            name: string;
            email: string;
            password: string;
            passwordExpireAt: number;
            passwordExpireAtTimeUnit: 'hour' | 'hours' | 'day' | 'days';
          }
        );
        return;
      default:
        throw new Error(`Unhandled email job: ${job.name}`);
    }
  }
}
