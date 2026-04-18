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
      const data = await TermAndCondition.findByIdAndUpdate(
        new Types.ObjectId('69830a30cf415936bf88788c'),
        { $set: { description } },
        { new: true }
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
      const data = await PrivacyAndPolicy.findByIdAndUpdate(
        new Types.ObjectId('69831919cf415936bf88789c'),
        { $set: { description } },
        { new: true }
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
      const data = await TermAndCondition.findById(
        new Types.ObjectId('69830a30cf415936bf88788c')
      );
      if (!data) {
        throw new Error(
          'Unknown error occurred in get Term And Condition service'
        );
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
      const data = await PrivacyAndPolicy.findById(
        new Types.ObjectId('69831919cf415936bf88789c')
      );
      if (!data) {
        throw new Error(
          'Unknown error occurred in get Privacy And Policy service'
        );
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
