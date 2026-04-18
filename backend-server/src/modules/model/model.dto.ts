import { Schema } from 'mongoose';

import { BaseDTO } from '@/core/base_classes/dto.base';
import { IModel } from '@/modules/model/model.types';

export class GetModelDTO extends BaseDTO<IModel> {
  public modelName: string;
  public _id: Schema.Types.ObjectId;
  public createdAt: Date;
  public updatedAt: Date;
  public modelImage: string;
  constructor(model: IModel) {
    super(model);
    this._id = model._id;
    this.modelImage = model.modelImage;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
    this.modelName = model.modelName;
  }
}
