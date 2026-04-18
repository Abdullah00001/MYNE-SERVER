import mongoose from 'mongoose';

import { env } from '@/env';

const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(env.DATABASE_URL);
    console.log('[Mongodb] Connected');
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Mongodb] connection failed:', error.message);
    } else {
      console.error('Unknown error during [Mongodb] connection');
    }
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('[MongoDB] Disconnecting...');
      await mongoose.disconnect();
      console.log('[MongoDB] Disconnected');
    }
  } catch (error) {
    console.error('[MongoDB] Error during disconnect', error);
  }
};

export default connectDatabase;
