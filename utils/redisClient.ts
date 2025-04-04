// src/utils/redisClient.ts
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL!);

redisClient.ping()
  .then(() => console.log('Connected to Redis'))
  .catch((error) => console.error('Redis connection error:', error));

export default redisClient;
