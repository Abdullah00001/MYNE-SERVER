import { Schema } from 'mongoose';
import { injectable } from 'tsyringe';

import { getRedisClient } from '@/configs/redis.config';
import { temporaryPasswordExpireAt } from '@/const';
import User from '@/modules/auth/auth.model';
import { AccountStatus, IUser } from '@/modules/auth/auth.types';
import {
  GetSingleUserResponseDTO,
  GetUsersResponseDTO,
} from '@/modules/user/user.dto';
import { GetUsersQueryParams, TCreateUser } from '@/modules/user/user.schemas';
import {
  PipelineStage,
  TGetUsersResponse,
  TUserActions,
} from '@/modules/user/user.types';
import { EmailQueue } from '@/queue/queues/email.queue';
import { Role } from '@/types/jwt.types';
import { PasswordUtils } from '@/utils/password.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class UserService {
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  constructor(
    private readonly passwordUtils: PasswordUtils,
    private readonly emailQueue: EmailQueue,
    private readonly systemUtils: SystemUtils
  ) {}
  async createUser({ payload }: { payload: TCreateUser }): Promise<void> {
    try {
      const redisClient = getRedisClient();
      const { name, email } = payload;
      const plainPassword = this.systemUtils.generateTemporaryPassword();
      const hashPassword = (await this.passwordUtils.hashPassword(
        plainPassword
      )) as string;
      const newUser = new User({
        name,
        email,
        isTermsAndPrivacyAccepted: true,
        termsAndPrivacyAcceptedAt: new Date(),
      });
      await newUser.save();
      await Promise.all([
        redisClient.set(
          `user:${newUser._id}:password`,
          hashPassword,
          'PX',
          this.systemUtils.calculateMilliseconds(
            temporaryPasswordExpireAt,
            'hours'
          )
        ),
        this.emailQueue.sendTemporaryPasswordToUserEmail({
          name,
          email,
          password: plainPassword,
          passwordExpireAt: temporaryPasswordExpireAt,
          passwordExpireAtTimeUnit: 'hours',
        }),
      ]);
      return;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in create users service');
    }
  }

  async getUsers({
    params,
  }: {
    params: GetUsersQueryParams;
  }): Promise<TGetUsersResponse> {
    try {
      const page = params.page ?? 1;
      const limit = params.limit ?? 10;
      const skip = (page - 1) * limit;

      const pipeline: PipelineStage[] = [];

      if (params.sortBy) {
        const sortOrder = params.sortBy === '-1' ? -1 : 1;
        pipeline.push({ $sort: { createdAt: sortOrder } });
      }

      pipeline.push({ $skip: skip }, { $limit: limit });

      // Build base match
      const baseMatch: Record<string, unknown> = { role: Role.USER };

      if (params.search) {
        const isEmail = this.EMAIL_REGEX.test(params.search);
        baseMatch.$or = isEmail
          ? [{ email: params.search.toLowerCase() }]
          : [{ name: { $regex: params.search, $options: 'i' } }];
      }

      const [result] = await User.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            data: pipeline,
            total: [{ $count: 'count' }],
          },
        },
      ]);

      const data: GetUsersResponseDTO[] = result.data.map((item: IUser) =>
        GetUsersResponseDTO.fromEntity(item)
      );

      const total = result.total[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit);
      const from = total === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, total);
      const showing = `Showing ${from} to ${to} of ${total} results`;

      const basePath = '/admin/users';
      const actions: TUserActions = {
        changeAccountStatus: { href: `${basePath}/:id`, method: 'PATCH' },
        getOne: { href: `${basePath}/:id`, method: 'GET' },
      };

      if (data.length === 0) {
        return {
          data,
          meta: {
            total,
            page,
            limit,
            totalPages,
            links: null,
            actions,
            showing,
          },
        };
      }

      const buildLink = (pageNum: number): string => {
        const query = new URLSearchParams();
        query.set('page', pageNum.toString());
        query.set('limit', limit.toString());
        if (params.sortBy) query.set('sortBy', params.sortBy);
        if (params.search) query.set('search', params.search);
        return `${basePath}?${query.toString()}`;
      };

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages,
          links: {
            first: buildLink(1),
            last: buildLink(totalPages),
            previous: page > 1 ? buildLink(page - 1) : null,
            next: page < totalPages ? buildLink(page + 1) : null,
            current: buildLink(page),
          },
          actions,
          showing,
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in get users service');
    }
  }

  async changeUserAccountStatus({
    accountStatus,
    userId,
  }: {
    accountStatus: AccountStatus;
    userId: Schema.Types.ObjectId;
  }): Promise<GetSingleUserResponseDTO> {
    try {
      const data = await User.findByIdAndUpdate(
        userId,
        { $set: { accountStatus } },
        { new: true }
      );
      if (!data)
        throw new Error(
          'Unknown error occurred in change user account status service'
        );
      return GetSingleUserResponseDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(
        'Unknown error occurred in change user account status service'
      );
    }
  }
}
