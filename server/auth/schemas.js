import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(64, 'Password too long'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long').optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long')
});
