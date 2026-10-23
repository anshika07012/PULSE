import { Router } from 'express';
import QueueToken from '../models/QueueToken.js';
import User from '../models/User.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { DEPARTMENTS, DOCTORS } from '../config/constants.js';

const router = Router();
router.use(protect);

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function getDoctors() {
  const registered = await User.find({ role: 'doctor' }).lean();
  const all = [...DOCTORS];
  for (const u of registered) {
    if (!all.some((d) => d.name === u.name)) all.push({ name: u.name, department: u.department });
  }
  return all;
}

const byPriority = (a, b) =>
  (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || a.tokenNumber - b.tokenNumber;

/** Builds the live queue with positions and estimated wait times. */
export async function buildQueue() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const tokens = await QueueToken.find({ createdAt: { $gte: since } })
    .sort({ tokenNumber: 1 })
    .lean();
  const doctors = await getDoctors();
  const now = Date.now();

  const waiting = tokens.filter((t) => t.status === 'waiting').sort(byPriority);
  const serving = tokens.filter((t) => t.status === 'in-consultation');

  const deptCounter = {};
  for (const t of waiting) {
    const dept = DEPARTMENTS.find((d) => d.name === t.department);
    const consult = dept?.consultMinutes ?? 10;
    const servers = Math.max(1, doctors.filter((d) => d.department === t.department).length);
    const current = serving.filter((s) => s.department === t.department);
    const remaining = current.length
      ? Math.min(...current.map((s) => Math.max(0, consult - (now - new Date(s.startedAt).getTime()) / 60000)))
      : 0;
    const idx = deptCounter[t.department] ?? 0;
    deptCounter[t.department] = idx + 1;
    t.position = idx + 1;
    t.estimatedWaitMin = Math.max(1, Math.round((remaining + idx * consult) / servers));
  }

  const completed = tokens.filter((t) => t.status === 'completed');
  const completedToday = completed.filter((t) => t.completedAt && t.completedAt >= startOfDay()).length;
  const avgWaitMin = waiting.length
    ? Math.round(waiting.reduce((s, t) => s + t.estimatedWaitMin, 0) / waiting.length)
    : 0;

  const visible = [
    ...serving,
    ...waiting,
    ...completed.slice(-5),
    ...tokens.filter((t) => t.status === 'cancelled').slice(-3),
  ];

  return {
    tokens: visible,
    stats: { waiting: waiting.length, inConsultation: serving.length, completedToday, avgWaitMin },
  };
}

const mask = (name) =>
  name
    .split(' ')
    .map((p) => p[0] + '*'.repeat(Math.max(2, p.length - 1)))
    .join(' ');

function privacyFilter(data, user) {
  if (user.role === 'doctor') return data;
  return {
    ...data,
    tokens: data.tokens.map((t) =>
      String(t.patient) === String(user._id) ? { ...t, mine: true } : { ...t, patientName: mask(t.patientName), reason: undefined }
    ),
  };
}

router.get('/meta', async (req, res) => {
  res.json({ departments: DEPARTMENTS, doctors: await getDoctors() });
});

router.get('/', async (req, res, next) => {
  try {
    res.json(privacyFilter(await buildQueue(), req.user));
  } catch (err) {
    next(err);
  }
});

// Book a new OPD token
router.post('/', async (req, res, next) => {
  try {
    const { department, doctor, reason, priority, patientName } = req.body;
    const dept = DEPARTMENTS.find((d) => d.name === department);
    if (!dept) return res.status(400).json({ message: 'Select a department.' });
    const doctors = await getDoctors();
    if (!doctors.some((d) => d.name === doctor && d.department === department)) {
      return res.status(400).json({ message: 'Select a doctor from that department.' });
    }

    const isDoctor = req.user.role === 'doctor';
    const name = isDoctor ? (patientName || '').trim() : req.user.name;
    if (name.length < 2) return res.status(400).json({ message: 'Enter the patient name.' });

    if (!isDoctor) {
      const existing = await QueueToken.findOne({
        patient: req.user._id,
        status: { $in: ['waiting', 'in-consultation'] },
      });
      if (existing) {
        return res.status(400).json({ message: `You already have an active token (#${existing.tokenNumber}).` });
      }
    }

    const last = await QueueToken.findOne().sort({ tokenNumber: -1 }).lean();
    const token = await QueueToken.create({
      tokenNumber: (last?.tokenNumber ?? 0) + 1,
      patient: isDoctor ? undefined : req.user._id,
      patientName: name,
      department,
      doctor,
      reason: reason?.slice(0, 200),
      priority: isDoctor && priority === 'urgent' ? 'urgent' : 'normal',
      consultMinutes: dept.consultMinutes,
    });
    res.status(201).json({ token, ...privacyFilter(await buildQueue(), req.user) });
  } catch (err) {
    next(err);
  }
});

// Doctor finishes the current consultation and calls the next patient from their department
router.post('/call-next', restrictTo('doctor'), async (req, res, next) => {
  try {
    const doc = req.user;
    await QueueToken.updateMany(
      { status: 'in-consultation', doctor: doc.name },
      { status: 'completed', completedAt: new Date() }
    );
    const waiting = (await QueueToken.find({ status: 'waiting', department: doc.department }).lean()).sort(byPriority);
    let called = null;
    if (waiting.length) {
      called = await QueueToken.findByIdAndUpdate(
        waiting[0]._id,
        { status: 'in-consultation', doctor: doc.name, startedAt: new Date() },
        { new: true }
      );
    }
    res.json({
      called,
      message: called ? `Token #${called.tokenNumber} called in.` : 'No patients waiting in your department.',
      ...(await buildQueue()),
    });
  } catch (err) {
    next(err);
  }
});

// Complete or cancel a token
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const token = await QueueToken.findById(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found.' });

    if (req.user.role === 'patient') {
      const own = String(token.patient) === String(req.user._id);
      if (!own || status !== 'cancelled' || token.status !== 'waiting') {
        return res.status(403).json({ message: 'You can only cancel your own waiting token.' });
      }
    } else if (!['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    token.status = status;
    if (status === 'completed') token.completedAt = new Date();
    await token.save();
    res.json(privacyFilter(await buildQueue(), req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
