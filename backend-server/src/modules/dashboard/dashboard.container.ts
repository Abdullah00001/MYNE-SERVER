import { container } from 'tsyringe'

import { DashboardController } from '@/modules/dashboard/dashboard.controllers'
import { DashboardMiddleware } from '@/modules/dashboard/dashboard.middlewares'
import { DashboardService } from '@/modules/dashboard/dashboard.services'

export const registerDashboardModule = (): void => {
  container.registerSingleton(DashboardService)
  container.registerSingleton(DashboardController)
  container.registerSingleton(DashboardMiddleware)
}