import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import modular routers
import adminRouter from './routes/admin.js';
import newsRouter from './routes/news.js';
import pensRouter from './routes/pens.js';
import breedsRouter from './routes/breeds.js';
import pigsRouter from './routes/pigs.js';
import healthRouter from './routes/health.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://swinesync.netlify.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Mount routers
app.use(adminRouter);
app.use(newsRouter);
app.use(pensRouter);
app.use(breedsRouter);
app.use(pigsRouter);
app.use(healthRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});