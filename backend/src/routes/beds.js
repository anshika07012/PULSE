import { Router } from 'express';
import Bed from '../models/Bed.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();
router.use(protect);

async function snapshot(user) {
  const beds = await Bed.find().sort({ floor: 1, ward: 1, label: 1 }).lean();
  const wardMap = new Map();
  for (const b of beds) {
    if (!wardMap.has(b.ward)) wardMap.set(b.ward, { ward: b.ward, floor: b.floor, type: b.wardType, total: 0, occupied: 0, available: 0, cleaning: 0 });
    const w = wardMap.get(b.ward);
    w.total++;
    w[b.status]++;
  }
  const byWard = [...wardMap.values()].map((w) => ({ ...w, occupancy: Math.round((w.occupied / w.total) * 100) }));
  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const available = beds.filter((b) => b.status === 'available').length;
  const cleaning = beds.filter((b) => b.status === 'cleaning').length;

  // Patients never see other patients' names
  const safeBeds = user.role === 'doctor' ? beds : beds.map((b) => ({ ...b, patientName: undefined }));
  return {
    beds: safeBeds,
    summary: {
      total: beds.length,
      occupied,
      available,
      cleaning,
      occupancy: beds.length ? Math.round((occupied / beds.length) * 100) : 0,
      byWard,
    },
  };
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await snapshot(req.user));
  } catch (err) {
    next(err);
  }
});

// Auto-allocate the next free bed in a ward
router.post('/admit', restrictTo('doctor'), async (req, res, next) => {
  try {
    const { ward, patientName } = req.body;
    if (!patientName || patientName.trim().length < 2) return res.status(400).json({ message: 'Enter the patient name.' });
    const bed = await Bed.findOneAndUpdate(
      { ward, status: 'available' },
      { status: 'occupied', patientName: patientName.trim(), since: new Date() },
      { new: true, sort: { label: 1 } }
    );
    if (!bed) return res.status(409).json({ message: `${ward} has no free beds.` });
    res.json({ bed, message: `${patientName.trim()} admitted to ${ward}, bed ${bed.label}.`, ...(await snapshot(req.user)) });
  } catch (err) {
    next(err);
  }
});

// Change a specific bed: admit / discharge / mark ready
router.patch('/:id', restrictTo('doctor'), async (req, res, next) => {
  try {
    const { status, patientName } = req.body;
    if (!['available', 'occupied', 'cleaning'].includes(status)) return res.status(400).json({ message: 'Invalid bed status.' });
    const bed = await Bed.findById(req.params.id);
    if (!bed) return res.status(404).json({ message: 'Bed not found.' });
    if (status === 'occupied') {
      if (!patientName || patientName.trim().length < 2) return res.status(400).json({ message: 'Enter the patient name.' });
      bed.patientName = patientName.trim();
      bed.since = new Date();
    } else {
      bed.patientName = undefined;
      bed.since = undefined;
    }
    bed.status = status;
    await bed.save();
    res.json(await snapshot(req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
