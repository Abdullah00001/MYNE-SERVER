import { env } from '@/env';
import TMailOption from '@/types/mailOption.type';

const mailOption = (to: string, subject: string, html: string): TMailOption => {
  const option: TMailOption = {
    from: 'no-reply@bookdianight.com', // Hardcoded since SMTP_USER is a Brevo login
    to,
    subject,
    html,
  };
  return option;
};

export default mailOption;
