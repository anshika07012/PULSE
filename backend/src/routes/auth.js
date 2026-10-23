import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect, signToken } from '../middleware/auth.js';
import { DEPARTMENTS } from '../config/constants.js';

const router = Router();
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, department, licenseId } = req.body;

    if (!['patient', 'doctor'].includes(role)) {
      return res.status(400).json({ message: 'Choose Patient Portal or Doctor Portal.' });
    }
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: 'Please enter your full name.' });
    }
    if (!emailRx.test(email || '')) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (role === 'doctor') {
      if (!DEPARTMENTS.some((d) => d.name === department)) {
        return res.status(400).json({ message: 'Select your department.' });
      }
      if (!licenseId || licenseId.trim().length < 5) {
        return res.status(400).json({ message: 'Enter your medical licence ID (at least 5 characters).' });
      }
    }

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ message: 'An account with this email already exists. Try logging in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      phone,
      department: role === 'doctor' ? department : undefined,
      licenseId: role === 'doctor' ? licenseId : undefined,
    });
    res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    if (role && user.role !== role) {
      const right = user.role === 'doctor' ? 'Doctor Portal' : 'Patient Portal';
      return res.status(403).json({ message: `This account belongs to the ${right}. Go back and choose it.` });
    }
    res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, (req, res) => res.json({ user: req.user.toSafeJSON() }));

export default router;
