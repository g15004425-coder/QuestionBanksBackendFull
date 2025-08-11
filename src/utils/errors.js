import { StatusCodes as S } from 'http-status-codes';

export class AppError extends Error {
  constructor(message, status = S.BAD_REQUEST) {
    super(message);
    this.status = status;
  }
}
