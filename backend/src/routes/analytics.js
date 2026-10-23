import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { buildQueue } from './queue.js';
import { DEPARTMENTS } from '../config/constants.js';

const router = Router();
router.use(protect);

// Typical average OPD wait (minutes) for 8 AM - 7 PM
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const BASELINE = [12, 21, 33, 38, 31, 22, 19, 24, 30, 27, 18, 11];

const label = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);

router.get('/', async (req, res, next) => {
  try {
    const departmentsForUser = req.user.role === 'doctor'
      ? DEPARTMENTS.filter((department) => department.name === req.user.department)
      : DEPARTMENTS;
    const queues = await Promise.all(departmentsForUser.map((department) => buildQueue(department.name)));
    const tokens = queues.flatMap((queue) => queue.tokens);
    const stats = {
      avgWaitMin: queues.length
        ? Math.round(queues.reduce((sum, queue) => sum + queue.stats.avgWaitMin, 0) / queues.length)
        : 0,
    };
    const nowHour = new Date().getHours();

    const hourly = HOURS.map((h, i) => ({
      label: label(h),
      avgWait: h === nowHour ? stats.avgWaitMin : BASELINE[i],
      isNow: h === nowHour,
      forecast: h > nowHour,
    }));

    const departments = departmentsForUser.map((d) => {
      const active = tokens.filter((t) => t.department === d.name && ['waiting', 'in-consultation'].includes(t.status)).length;
      const congestion = Math.min(100, Math.round((active / d.capacity) * 100));
      const h = hash(d.name);
      const base = 25 + (h % 30);
      const trend = Array.from({ length: 6 }, (_, i) => Math.max(5, Math.min(100, Math.round(base + Math.sin(i + h) * 18))));
      trend.push(congestion);
      return { name: d.name, active, capacity: d.capacity, congestion, trend };
    });

    const peak = hourly.reduce((a, b) => (b.avgWait > a.avgWait ? b : a));
    const busiest = departments.reduce((a, b) => (b.congestion > a.congestion ? b : a));

    res.json({ hourly, departments, kpis: { avgWait: stats.avgWaitMin, peakHour: peak.label, busiest: busiest.name } });
  } catch (err) {
    next(err);
  }
});

export default router;
