import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err, req, res, next) {
  // If response headers are already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // 1. Zod Validation Error -> 400
  if (err instanceof ZodError) {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details,
    });
  }

  // 2. Custom AppError (400, 404, 409, etc.)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  // 3. Mongoose Duplicate Key Error (E11000) -> 409 Conflict
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return res.status(409).json({
      error: `Duplicate value for ${field}: '${value}' already exists`,
      details: err.keyValue,
    });
  }

  // 4. Mongoose CastError (e.g. invalid ObjectId) -> 400
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Invalid identifier format for ${err.path}`,
      details: err.value,
    });
  }

  // 5. Mongoose ValidationError -> 400
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      error: 'Database validation failed',
      details,
    });
  }

  // 6. Generic Fallback -> 500
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
}
