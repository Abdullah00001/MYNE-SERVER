import { BaseDTO } from '@/core/base_classes/dto.base';
import { IUserBag } from '@/modules/userBag/userBag.types';

export class CreateCollectionDTO extends BaseDTO<IUserBag> {
  constructor(bag: IUserBag) {
    super(bag);
  }
}
