import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import modular routers
import adminRouter from './routes/admin.js';
import pensRouter from './routes/pens.js';
import breedsRouter from './routes/breeds.js';
import pigsRouter from './routes/pigs.js';
import healthRouter from './routes/health.js';
import breedingLogsRouter from './routes/breedingLogs.js';
import growthRouter from './routes/growth.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://swinesync.netlify.app',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow explicitly listed origins or any Vercel deployment (*.vercel.app)
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    const msg = `The CORS policy for this site does not allow access from origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true
}));

app.use(express.json());

// Mount routers
app.use(adminRouter);
app.use(pensRouter);
app.use(breedsRouter);
app.use(pigsRouter);
app.use(healthRouter);
app.use(breedingLogsRouter);
app.use(growthRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});