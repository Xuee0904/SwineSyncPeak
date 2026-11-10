import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config(); // fallback to current working directory .env

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
import transactionsRouter from './routes/transactions.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://swinesync.netlify.app',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow explicitly listed origins, any local dev port/host, or cloud deployments
    if (
      allowedOrigins.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin) ||
      /^https:\/\/.*\.trycloudflare\.com$/.test(origin) ||
      /^https:\/\/.*\.netlify\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
  res.status(200).send('SwineSync API is operational');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routers
app.use(adminRouter);
app.use(pensRouter);
app.use(breedsRouter);
app.use(pigsRouter);
app.use(healthRouter);
app.use(breedingLogsRouter);
app.use(growthRouter);
app.use(transactionsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});