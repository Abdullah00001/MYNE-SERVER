import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { LegalService } from '@/modules/legal/legal.services';

@injectable()
export class LegalController extends BaseController {
  public updateTermAndCondition: RequestHandler;
  public updatePrivacyAndPolicy: RequestHandler;
  public getPrivacyAndPolicy: RequestHandler;
  public getTermAndCondition: RequestHandler;

  constructor(private readonly legalService: LegalService) {
    super();
    this.updateTermAndCondition = this.wrap(this._updateTermAndCondition);
    this.updatePrivacyAndPolicy = this.wrap(this._updatePrivacyAndPolicy);
    this.getPrivacyAndPolicy = this.wrap(this._getPrivacyAndPolicy);
    this.getTermAndCondition = this.wrap(this._getTermAndCondition);
  }

  private async _updateTermAndCondition(
    req: Request,
    res: Response
  ): Promise<void> {
    const { description } = req.body;
    const data = await this.legalService.updateTermAndCondition({
      description,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Term And Condition update successful',
      data,
    });
  }

  private async _updatePrivacyAndPolicy(
    req: Request,
    res: Response
  ): Promise<void> {
    const { description } = req.body;
    const data = await this.legalService.updatePrivacyAndPolicy({
      description,
    });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Privacy And Policy update successful',
      data,
    });
  }
  private async _getTermAndCondition(
    _req: Request,
    res: Response
  ): Promise<void> {
    const data = await this.legalService.getTermAndCondition();
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Privacy And Policy retrieve successful',
      data,
    });
  }
  private async _getPrivacyAndPolicy(
    _req: Request,
    res: Response
  ): Promise<void> {
    const data = await this.legalService.getPrivacyAndPolicy();
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Privacy And Policy retrieve successful',
      data,
    });
  }
}