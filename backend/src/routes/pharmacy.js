import { Router } from 'express';
import Medicine from '../models/Medicine.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();
router.use(protect);

const summarize = (items) => ({
  total: items.length,
  low: items.filter((m) => m.status === 'low').length,
  out: items.filter((m) => m.status === 'out').length,
});

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const filter = q
      ? { $or: [{ name: new RegExp(q, 'i') }, { genericName: new RegExp(q, 'i') }, { category: new RegExp(q, 'i') }] }
      : {};
    const items = (await Medicine.find(filter).sort({ name: 1 })).map((m) => m.toJSON());
    res.json({ items, summary: summarize(items) });
  } catch (err) {
    next(err);
  }
});

router.post('/', restrictTo('doctor'), async (req, res, next) => {
  try {
    const { name, genericName, category, stock, minStock, price, unit, expiry } = req.body;
    if (!name || !category) return res.status(400).json({ message: 'Name and category are required.' });
    const med = await Medicine.create({
      name,
      genericName,
      category,
      stock: Math.max(0, Number(stock) || 0),
      minStock: Math.max(0, Number(minStock) || 20),
      price: Math.max(0, Number(price) || 0),
      unit: unit || 'strips',
      expiry: expiry || undefined,
    });
    res.status(201).json(med.toJSON());
  } catch (err) {
    next(err);
  }
});

// Dispense (negative delta) or restock (positive delta)
router.patch('/:id/stock', restrictTo('doctor'), async (req, res, next) => {
  try {
    const delta = Number(req.body.delta);
    if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ message: 'Enter a stock change.' });
    const med = await Medicine.findById(req.params.id);
    if (!med) return res.status(404).json({ message: 'Medicine not found.' });
    if (med.stock + delta < 0) return res.status(400).json({ message: `Only ${med.stock} ${med.unit} of ${med.name} left.` });
    med.stock += delta;
    await med.save();
    res.json(med.toJSON());
  } catch (err) {
    next(err);
  }
});

export default router;
