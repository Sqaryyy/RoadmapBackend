// src/middleware/rateLimiter.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../server';
import { Request, Response, NextFunction } from 'express';

// General API rate limiter - more permissive
export const generalLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'general_limiter',
  points: 100,        // 100 requests
  duration: 60,       // per minute
  blockDuration: 300, // Block for 5 minutes if exceeded
});

// AI routes rate limiter - more restrictive
export const aiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ai_limiter',
  points: 20,         // 20 requests
  duration: 60,       // per minute
  blockDuration: 600, // Block for 10 minutes if exceeded
});

// Middleware function for general rate limiting
export const generalRateLimiterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // You can use user ID if authenticated, otherwise use IP
  const key = (req as any).auth?.userId || req.ip;
  
  generalLimiter.consume(key)
    .then(() => {
      next();
    })
    .catch((rejRes) => {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: secs
      });
    });
};

// Middleware function for AI routes rate limiting
export const aiRateLimiterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // You can use user ID if authenticated, otherwise use IP
  const key = (req as any).auth?.userId || req.ip;
  
  aiLimiter.consume(key)
    .then(() => {
      next();
    })
    .catch((rejRes) => {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        error: 'Too Many Requests - AI endpoint limit exceeded',
        retryAfter: secs
      });
    });
};