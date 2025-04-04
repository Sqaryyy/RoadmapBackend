import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import routes from './routes'; // Import the main router
import { clerkMiddleware } from '@clerk/express';
import redisClient from './utils/redisClient'; // ✅ Import from new redisClient file

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Define allowed origins
const allowedOrigins = [
  'https://roadmap.it.com',
  'http://localhost:3000', // Replace with your actual domain
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
app.use(express.json()); // Optional: Add body parser

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database_name')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => console.error('❌ MongoDB connection error:', error));

// Clerk Middleware
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })
);

// Attach redisClient to the request object if needed elsewhere
app.use((req, res, next) => {
  (req as any).redisClient = redisClient;
  next();
});

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
