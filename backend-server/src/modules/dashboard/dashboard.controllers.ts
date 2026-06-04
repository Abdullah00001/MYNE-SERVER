import { Request, Response, RequestHandler } from 'express';
import { injectable } from 'tsyringe';

import { BaseController } from '@/core/base_classes/base.controller';
import { DashboardService } from '@/modules/dashboard/dashboard.services';
import { TDashboardStatsQueryParamsSchema } from '@/modules/dashboard/dashboard.schemas';
import { IUser } from '@/modules/auth/auth.types';

@injectable()
export class DashboardController extends BaseController {
  public adminDashboardStat: RequestHandler;
  public appDashboardStat: RequestHandler;

  constructor(private readonly dashboardService: DashboardService) {
    super();
    this.adminDashboardStat = this.wrap(this._adminDashboardStat);
    this.appDashboardStat = this.wrap(this._appDashboardStat);
  }

  private async _adminDashboardStat(
    req: Request,
    res: Response
  ): Promise<void> {
    const query = req.validatedQuery as TDashboardStatsQueryParamsSchema;
    const data = await this.dashboardService.adminDashboardStat({ query });
    res.status(200).json({
      success: true,
      status: 200,
      message: 'Admin Dashboard Stat Retrieve Successful',
      data,
    });
    return;
  }

  private async _appDashboardStat(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser;
    const { period } = req.query as { period?: string };
    const data = await this.dashboardService.appDashboardStat({ user, period });
    console.log('app dashboard data: ', data);
    res.status(200).json({
      success: true,
      status: 200,
      message: 'App Dashboard Stat Retrieve Successful',
      data,
    });
    return;
  }
}
