export class AppError extends Error { constructor(public status: number, message: string) { super(message); } }
export const asyncH = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);
