import { join, extname } from 'path';

import { JwtPayload } from 'jsonwebtoken';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import { IUser } from '@/modules/auth/auth.types';
import {
  GetBrandForAdminDTO,
  GetBrandForUSerDTO,
} from '@/modules/brand/brand.dto';
import Brand from '@/modules/brand/brand.model';
import {
  IBrand,
  TBrandActions,
  TGetBrandsResponse,
} from '@/modules/brand/brand.types';
import { Role } from '@/types/jwt.types';
import { S3Utils } from '@/utils/s3.utils';
import { SystemUtils } from '@/utils/system.utils';

@injectable()
export class BrandService {
  constructor(
    private readonly s3Utils: S3Utils,
    private readonly systemUtils: SystemUtils
  ) {}

  async getBrands({
    params,
    user,
  }: {
    params: { page: string | null; limit: string | null };
    user: IUser | JwtPayload;
  }): Promise<TGetBrandsResponse> {
    try {
      const page = parseInt(params.page || '1', 10);
      const limit = parseInt(params.limit || '10', 10);
      const skip = (page - 1) * limit;
      const isAdmin = user.role === Role.ADMIN;
      const [result] = await Brand.aggregate([
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
      ]);

      const rawData = result.data || [];
      const total = result.total[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      const data = isAdmin
        ? rawData.map((brand: IBrand) => GetBrandForAdminDTO.fromEntity(brand))
        : rawData.map((brand: IBrand) => GetBrandForUSerDTO.fromEntity(brand));

      // Calculate showing range
      const from = total === 0 ? 0 : skip + 1;
      const to = Math.min(skip + limit, total);
      const showing = `Showing ${from} to ${to} of ${total} results`;

      // Determine base path based on user role
      const basePath = user.role === 'admin' ? '/admin/brands' : '/brands';

      const actions: TBrandActions = {
        create: isAdmin
          ? {
              href: `${basePath}`,
              method: 'POST',
            }
          : undefined,
        update:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'PUT',
              }
            : undefined,
        delete:
          isAdmin && data.length > 0
            ? {
                href: `${basePath}/:id`,
                method: 'DELETE',
              }
            : undefined,
      };

      // If no data, return null for links
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

      // Helper function to build links
      const buildLink = (pageNum: number): string => {
        const query = new URLSearchParams();
        query.set('page', pageNum.toString());
        query.set('limit', limit.toString());
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
      throw new Error('Unknown error occurred in get brands service');
    }
  }

  async createBrand({
    brandName,
    fileName,
    user,
    mimeType,
  }: {
    brandName: string;
    fileName: string;
    user: JwtPayload;
    mimeType: string;
  }): Promise<GetBrandForAdminDTO> {
    try {
      const filePath = join(__dirname, '../../../public/temp', fileName);
      const fileExtension = extname(filePath);
      const s3Key = `brands/${uuidv4()}/${Date.now()}${fileExtension}`;
      const url = await this.s3Utils.singleUpload({
        filePath,
        key: s3Key,
        mimeType,
      });
      const newBrand = new Brand({
        brandLogo: url,
        brandName,
        createdBy: user?.sub,
      });
      await newBrand.save();
      const response = GetBrandForAdminDTO.fromEntity(newBrand);
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in create brand service');
    }
  }

  async deleteBrand({ brand }: { brand: IBrand }): Promise<void> {
    try {
      const key = this.systemUtils.extractS3KeyFromUrl(brand.brandLogo);
      await Promise.all([
        this.s3Utils.singleDelete({ key }),
        Brand.deleteOne({ _id: brand._id }),
      ]);
      return;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in delete brand service');
    }
  }

  async searchBrand({
    brandName,
    user,
  }: {
    brandName: string;
    user: JwtPayload | IUser;
  }): Promise<GetBrandForAdminDTO[] | GetBrandForUSerDTO[]> {
    try {
      const escapedQuery = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Search with multiple strategies
      const data = await Brand.find({
        $or: [
          // Exact match (highest priority)
          { brandName: { $regex: `^${escapedQuery}$`, $options: 'i' } },
          // Starts with
          { brandName: { $regex: `^${escapedQuery}`, $options: 'i' } },
          // Contains
          { brandName: { $regex: escapedQuery, $options: 'i' } },
        ],
      }).limit(50);
      if (!data) throw new Error('Something went wrong on brand search');
      if (user?.role === Role.ADMIN) {
        const response = data.map((item) =>
          GetBrandForAdminDTO.fromEntity(item)
        );
        return response;
      }
      const response = data.map((item) => GetBrandForUSerDTO.fromEntity(item));
      return response;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in delete brand service');
    }
  }
  async editBrandInfo({
    brand,
    fileName,
    brandName,
    mimeType,
  }: {
    brand: IBrand;
    fileName?: string;
    brandName?: string;
    mimeType?: string;
  }): Promise<GetBrandForAdminDTO> {
    try {
      let brandLogo = brand.brandLogo;

      if (fileName && mimeType) {
        if (brandLogo) {
          const key = this.systemUtils.extractS3KeyFromUrl(brand.brandLogo);
          if (key) await this.s3Utils.singleDelete({ key });
        }

        const filePath = join(__dirname, '../../../public/temp', fileName);
        const fileExtension = extname(filePath);
        const s3Key = `brands/${uuidv4()}/${Date.now()}${fileExtension}`;

        brandLogo = await this.s3Utils.singleUpload({
          filePath,
          key: s3Key,
          mimeType,
        });
      }

      const updatePayload: { brandLogo: string; brandName?: string } = {
        brandLogo,
      };
      if (brandName) updatePayload.brandName = brandName;

      const data = await Brand.findByIdAndUpdate(
        brand?._id,
        { $set: updatePayload },
        { new: true, runValidators: true }
      );

      if (!data)
        throw new Error('Something went wrong on brand info update operation');

      return GetBrandForAdminDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in edit brand service');
    }
  }

  async editBrandName({
    brandName,
    brand,
  }: {
    brandName: string;
    brand: IBrand;
  }): Promise<GetBrandForAdminDTO> {
    try {
      const data = await Brand.findByIdAndUpdate(
        brand?._id,
        { $set: { brandName } },
        { new: true, runValidators: true }
      );
      if (!data)
        throw new Error('Something went wrong on brand info update operation');
      return GetBrandForAdminDTO.fromEntity(data);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in delete brand service');
    }
  }
}
