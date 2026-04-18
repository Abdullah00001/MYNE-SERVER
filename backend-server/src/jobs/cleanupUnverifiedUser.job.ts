import {schedule} from 'node-cron';
import { container } from 'tsyringe';

import { logger } from '@/configs';
import User from '@/modules/auth/auth.model';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';

const cleanupUnverifiedUsers = async (): Promise<void> => {
  const s3Utils = container.resolve(S3Utils);
  const systemUtils = container.resolve(SystemUtils);
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  try {
    const users = await User.find(
      {
        isVerified: false,
        createdAt: { $lte: thresholdDate },
      },
      '_id avatar'
    );
    if (users.length === 0) {
      logger.info('[unverified user cleanup] No users to cleanup');
      return;
    }
    logger.info(
      `[unverified user cleanup] Found ${users.length} users to cleanup`
    );
    const avatarDeletions = users
      .filter((user) => user.avatar && user.avatar !== null)
      .map(async (user) => {
        try {
          const key = systemUtils.extractS3KeyFromUrl(user.avatar);
          await s3Utils.singleDelete({ key });
        } catch (error) {
          logger.warn(
            `[unverified user cleanup] Failed to delete avatar for user ${user._id}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      });
    await Promise.all(avatarDeletions);

    const userIds = users.map((user) => user._id);
    const { deletedCount } = await User.deleteMany({
      _id: { $in: userIds },
    });
    logger.info(
      `[unverified user cleanup] Successfully deleted ${deletedCount} users and their avatars`
    );
    return;
  } catch (error) {
    if (error instanceof Error)
      logger.error('[unverified user cleanup] Job failed:', error.message);
    logger.error('[unverified user cleanup] Job failed: Due to unknown error');
  }
};

schedule('0 0 * * *', () => {
  cleanupUnverifiedUsers().catch((error) => {
    logger.error(
      '[unverified user cleanup] Unhandled error in cron job:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  });
});
