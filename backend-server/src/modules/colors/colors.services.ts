import { injectable } from 'tsyringe';

import { GetColorDTO } from '@/modules/colors/colors.dto';
import Color from '@/modules/colors/colors.model';
import { IColor, TGetColorsResponse } from '@/modules/colors/colors.types';

@injectable()
export class ColorsService {
  public async getColors({
    params,
  }: {
    params: { search?: string; page?: string; limit?: string };
  }): Promise<TGetColorsResponse> {
    try {
      const page = Math.max(parseInt(params.page || '1', 10) || 1, 1);
      const limit = Math.max(parseInt(params.limit || '10', 10) || 10, 1);
      const skip = (page - 1) * limit;
      const search = params.search?.trim();
      const matchStage = search
        ? [
            {
              $match: {
                colorName: {
                  $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  $options: 'i',
                },
              },
            },
          ]
        : [];

      const [result] = await Color.aggregate([
        ...matchStage,
        { $sort: { colorName: 1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
      ]);

      const rawData = (result?.data || []) as IColor[];
      const totalColors = result?.total?.[0]?.count || 0;
      const totalPages = Math.ceil(totalColors / limit);
      const lastPage = totalPages || 1;
      const currentPage = Math.min(page, lastPage);
      const data = rawData.map((color) => GetColorDTO.fromEntity(color));

      return {
        data,
        meta: {
          totalColors,
          totalPages,
          links: {
            currentPage,
            nextPage: currentPage < totalPages ? currentPage + 1 : null,
            previousPage: currentPage > 1 ? currentPage - 1 : null,
            firstPage: 1,
            lastPage,
          },
        },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in get colors service');
    }
  }

  public async addColor({
    colorName,
  }: {
    colorName: string;
  }): Promise<GetColorDTO> {
    try {
      const newColor = new Color({ colorName });
      await newColor.save();
      return GetColorDTO.fromEntity(newColor);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Unknown error occurred in add color service');
    }
  }
}
