import { z } from 'zod';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError || error.name === 'ZodError') {
        const issues = error.errors || error.issues || [];
        logger.info({ errors: issues }, 'Validation failed');
        return res.status(400).json({
          error: 'Validation failed',
          errors: issues.map(e => ({
            path: e.path ? e.path.join('.') : '',
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}
