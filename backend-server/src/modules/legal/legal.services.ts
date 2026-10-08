import { Types } from 'mongoose';
import { injectable } from 'tsyringe';

import { PrivacyAndPolicy, TermAndCondition } from './legal.model';

import {
  IPrivacyAndPolicy,
  ITermAndCondition,
} from '@/modules/legal/legal.types';

@injectable()
export class LegalService {
  async updateTermAndCondition({
    description,
  }: {
    description: string;
  }): Promise<ITermAndCondition> {
    try {
      const data = await TermAndCondition.findOneAndUpdate(
        {},
        { $set: { description } },
        { new: true, upsert: true }
      );
      if (!data) {
        throw new Error(
          'Unknown error occurred in update Term And Condition service'
        );
      }
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown error occurred in update Term And Condition service'
      );
    }
  }

  async updatePrivacyAndPolicy({
    description,
  }: {
    description: string;
  }): Promise<IPrivacyAndPolicy> {
    try {
      const data = await PrivacyAndPolicy.findOneAndUpdate(
        {},
        { $set: { description } },
        { new: true, upsert: true }
      );
      if (!data) {
        throw new Error(
          'Unknown error occurred in update Privacy And Policy service'
        );
      }
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown error occurred in update Privacy And Policy service'
      );
    }
  }

  async getTermAndCondition(): Promise<ITermAndCondition> {
    try {
      let data = await TermAndCondition.findOne();
      if (!data) {
        data = await TermAndCondition.create({ description: '' });
      }
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown error occurred in get Privacy And Policy service'
      );
    }
  }

  async getPrivacyAndPolicy(): Promise<IPrivacyAndPolicy> {
    try {
      let data = await PrivacyAndPolicy.findOne();
      if (!data) {
        data = await PrivacyAndPolicy.create({ description: '' });
      }
      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown error occurred in get Privacy And Policy service'
      );
    }
  }
}
