import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './src/config/db.js';
import { seedIfEmpty } from './src/seed.js';
import authRoutes from './src/routes/auth.js';
import queueRoutes from './src/routes/queue.js';
import pharmacyRoutes from './src/routes/pharmacy.js';
import bedRoutes from './src/routes/beds.js';
import analyticsRoutes from './src/routes/analytics.js';

process.env.JWT_SECRET ||= 'pulse-dev-secret-change-me';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'PULSE API' }));
app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server. Please try again.' });
});

const PORT = process.env.PORT || 5050;

connectDB()
  .then(seedIfEmpty)
  .then(() => app.listen(PORT, () => console.log(`PULSE API running at http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
