import { TActionLink, TPaginationLinks } from '@/modules/blog/blog.types';
import { GetUsersResponseDTO } from '@/modules/user/user.dto';

export type TUserActions = {
  getOne: TActionLink;
  changeAccountStatus: TActionLink;
};

export type TGetUsersResponse = {
  data: GetUsersResponseDTO[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    links: TPaginationLinks | null;
    actions?: TUserActions;
    showing: string;
  };
};

export type PipelineStage =
  | { $sort: { createdAt: 1 | -1 } }
  | { $skip: number }
  | { $limit: number };
