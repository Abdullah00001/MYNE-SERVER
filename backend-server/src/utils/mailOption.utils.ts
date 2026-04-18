import { env } from '@/env';
import TMailOption from '@/types/mailOption.type';

const mailOption = (to: string, subject: string, html: string): TMailOption => {
  const option: TMailOption = {
    from: env.SMTP_USER as string,
    to,
    subject,
    html,
  };
  return option;
};

export default mailOption;
