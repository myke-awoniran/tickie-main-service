import { IExpressRequest } from '../interfaces';
import { Response as ExpressResponse } from 'express';
import * as userService from '../services/user.service';
import * as ResponseManager from '../helpers/response.manager';

export async function handleGetMyProfile(req: IExpressRequest, res: ExpressResponse): Promise<void> {
  try {
    const userId = req.userId;
    const response = await userService.getMyProfile(userId!);
    ResponseManager.success(res, response);
  } catch (err: any) {
    ResponseManager.handleError(res, err);
  }
}
