import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import routes from './routes'; // Import the main router
import { clerkMiddleware } from '@clerk/express';
import Redis from 'ioredis'; // Import Redis

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Redis (before your routes)
export const redisClient = new Redis(process.env.REDIS_URL!); // Ensure REDIS_URL is set

// Test Redis connection (optional, but recommended)
redisClient.ping()
  .then(() => console.log('Connected to Redis'))
  .catch((error) => console.error('Redis connection error:', error));

// Define allowed origins
const allowedOrigins = [
  'https://roadmap.it.com', 
  'http://localhost:3000',// Replace with your actual domain
];

// CORS Options
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true); // Allow
    } else {
      callback(new Error('Not allowed by CORS')); // Deny
    }
  },
  credentials: true, // Allow cookies to be sent cross-origin
};

// Middleware
app.use(cors(corsOptions));

// Connect to MongoDB (replace with your actual connection string)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database_name')
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('MongoDB connection error:', error));

  app.use(
    clerkMiddleware({
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
        secretKey: process.env.CLERK_SECRET_KEY,
    })
);

// Make redisClient available in req object
app.use((req, res, next) => {
    (req as any).redisClient = redisClient;
    next();
});

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

// Use the routes
app.use('/api', routes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;