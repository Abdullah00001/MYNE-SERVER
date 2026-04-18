import bcrypt from 'bcrypt';
import { injectable } from 'tsyringe';

import logger from '@/configs/logger.config';
import { saltRound } from '@/const';

@injectable()
export class PasswordUtils {
  /**
   * Hash a plain password using bcrypt
   */
  async hashPassword(passwordString: string): Promise<string | null> {
    try {
      return await bcrypt.hash(passwordString, saltRound);
    } catch (error) {
      if (error instanceof Error) {
        logger.warn(`Error Occurred In Hash Password Utils: ${error.message}`);
      } else {
        logger.warn('Unexpected Error Occurred In Hash Password Utils');
      }
      return null;
    }
  }

  /**
   * Compare plain password with hashed password
   */
  async comparePassword(
    requestedPassword: string,
    hashPassword: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(requestedPassword, hashPassword);
    } catch (error) {
      if (error instanceof Error) {
        logger.warn(
          `Error Occurred In Compare Password Utils: ${error.message}`
        );
        throw error;
      } else {
        logger.warn('Unexpected Error Occurred In Compare Password Utils');
        throw new Error('Unexpected Error Occurred In Compare Password Utils');
      }
    }
  }
}
