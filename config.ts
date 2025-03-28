// src/config.ts
export const CONFIG = {
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/skillTracker',
    PORT: process.env.PORT || 3000
  };