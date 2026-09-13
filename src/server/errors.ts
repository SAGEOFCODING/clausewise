export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "APP_ERROR"
  ) {
    super(message);
  }
}

export function userError(status: number, message: string, code?: string) {
  return new AppError(status, message, code);
}
