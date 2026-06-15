import { BaseDTO } from '@/core/base_classes/dto.base';
import { IColor } from '@/modules/colors/colors.types';

export class GetColorDTO extends BaseDTO<IColor> {
  public _id: string;
  public colorName: string;

  constructor(color: IColor) {
    super(color);
    this._id = String(color._id);
    this.colorName = color.colorName;
  }
}
