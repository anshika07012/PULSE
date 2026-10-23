import { Router } from 'express';
import QueueToken from '../models/QueueToken.js';
import QueueCounter from '../models/QueueCounter.js';
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

export const getSessionKey = (at = new Date()) => at.toISOString().slice(0, 10);

async function nextTokenNumber(department, sessionKey) {
  const counter = await QueueCounter.findOneAndUpdate(
    { department, sessionKey },
    { $inc: { lastTokenNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.lastTokenNumber;
}

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

const isEmergencyRequest = (priority, emergency) =>
  emergency === true || priority === 'emergency';

const routineQueueFilter = (department, sessionKey) => ({
  department,
  sessionKey,
  status: { $in: ['waiting', 'in-consultation', 'completed', 'cancelled'] },
  emergency: { $ne: true },
});

/** Builds the live queue with positions and estimated wait times. */
export async function buildQueue(department) {
  if (!department) throw new Error('Department is required.');
  const sessionKey = getSessionKey();
  const dept = DEPARTMENTS.find((d) => d.name === department);
  if (!dept) throw new Error('Unknown department.');

  const tokens = await QueueToken.find(routineQueueFilter(department, sessionKey))
    .sort({ priority: -1, tokenNumber: 1 })
    .lean();
  const doctors = await getDoctors();
  const now = Date.now();
  const servers = Math.max(1, doctors.filter((d) => d.department === department).length);

  const waiting = tokens.filter((t) => t.status === 'waiting').sort(byPriority);
  const serving = tokens.filter((t) => t.status === 'in-consultation');
  const remaining = serving.length
    ? Math.min(...serving.map((s) => {
        const elapsed = s.startedAt ? (now - new Date(s.startedAt).getTime()) / 60000 : 0;
        return Math.max(0, s.consultMinutes - elapsed);
      }))
    : 0;

  for (const [idx, token] of waiting.entries()) {
    token.position = idx + 1;
    token.estimatedWaitMin = Math.max(1, Math.round((remaining + idx * dept.consultMinutes) / servers));
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
    const department = req.user.role === 'doctor' ? req.user.department : req.query.department;
    if (!department) return res.status(400).json({ message: 'Select a department.' });
    res.json(privacyFilter(await buildQueue(department), req.user));
  } catch (err) {
    next(err);
  }
});

// Book a new OPD token
router.post('/', async (req, res, next) => {
  try {
    const { department, doctor, reason, priority, patientName } = req.body;
    const emergency = isEmergencyRequest(priority, req.body.emergency);
    const dept = DEPARTMENTS.find((d) => d.name === department);
    if (!dept) return res.status(400).json({ message: 'Select a department.' });
    const doctors = await getDoctors();
    if (!doctors.some((d) => d.name === doctor && d.department === department)) {
      return res.status(400).json({ message: 'Select a doctor from that department.' });
    }

    const isDoctor = req.user.role === 'doctor';
    if (emergency && !isDoctor) {
      return res.status(403).json({ message: 'Only doctors can register emergency cases.' });
    }
    if (isDoctor && req.user.department !== department) {
      return res.status(403).json({ message: 'You can only create tokens in your department.' });
    }
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

    const sessionKey = getSessionKey();
    const tokenNumber = await nextTokenNumber(department, sessionKey);
    const token = await QueueToken.create({
      tokenNumber,
      sessionKey,
      patient: isDoctor ? undefined : req.user._id,
      patientName: name,
      department,
      doctor,
      reason: reason?.slice(0, 200),
      priority: emergency ? 'emergency' : isDoctor && priority === 'urgent' ? 'urgent' : 'normal',
      emergency,
      consultMinutes: dept.consultMinutes,
    });
    res.status(201).json({ token, ...privacyFilter(await buildQueue(department), req.user) });
  } catch (err) {
    next(err);
  }
});

// Doctor finishes the current consultation and calls the next patient from their department
router.post('/call-next', restrictTo('doctor'), async (req, res, next) => {
  try {
    const doc = req.user;
    await QueueToken.updateMany(
      { status: 'in-consultation', doctor: doc.name, department: doc.department, sessionKey: getSessionKey(), emergency: { $ne: true } },
      { status: 'completed', completedAt: new Date() }
    );
    const waiting = (await QueueToken.find({
      status: 'waiting', department: doc.department, sessionKey: getSessionKey(), emergency: { $ne: true }
    }).lean()).sort(byPriority);
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
      ...(await buildQueue(doc.department)),
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

    if (req.user.role === 'doctor' && token.department !== req.user.department) {
      return res.status(403).json({ message: 'You can only manage your department’s queue.' });
    }

    if (req.user.role === 'patient') {
      const own = String(token.patient) === String(req.user._id);
      if (!own || status !== 'cancelled' || token.status !== 'waiting') {
        return res.status(403).json({ message: 'You can only cancel your own waiting token.' });
      }
    } else if (!['completed', 'cancelled', 'skipped'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    token.status = status;
    if (status === 'completed') token.completedAt = new Date();
    await token.save();
    res.json(privacyFilter(await buildQueue(token.department), req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
