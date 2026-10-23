import bcrypt from 'bcryptjs';
import User from './models/User.js';
import QueueToken from './models/QueueToken.js';
import QueueCounter from './models/QueueCounter.js';
import Medicine from './models/Medicine.js';
import Bed from './models/Bed.js';
import { DEPARTMENTS } from './config/constants.js';

const mins = (m) => new Date(Date.now() - m * 60000);
const days = (d) => new Date(Date.now() + d * 86400000);

const NAMES = ['Rohan Mehta', 'Priya Singh', 'Amit Tiwari', 'Sana Khan', 'Deepak Yadav', 'Anjali Mishra', 'Vivek Pandey', 'Kavya Joshi', 'Imran Ali', 'Neelam Rawat', 'Harsh Vardhan', 'Pooja Saxena'];

async function seedUsers() {
  if (await User.countDocuments()) return;
  const passwordHash = await bcrypt.hash('demo123', 10);
  await User.create([
    { name: 'Riya Sharma', email: 'patient@pulse.demo', passwordHash, role: 'patient', phone: '9876543210' },
    { name: 'Dr. Aisha Verma', email: 'doctor@pulse.demo', passwordHash, role: 'doctor', department: 'Cardiology', licenseId: 'MCI-204518' },
    { name: 'Dr. Aarav Patel', email: 'cardiology.demo@pulse.local', passwordHash, role: 'doctor', department: 'Cardiology', licenseId: 'MCI-204519' },
    { name: 'Dr. Neha Kapoor', email: 'medicine.doctor@pulse.local', passwordHash, role: 'doctor', department: 'General Medicine', licenseId: 'MCI-204520' },
  ]);
}

async function seedQueue() {
  if (await QueueToken.countDocuments()) return;
  const d = (name) => DEPARTMENTS.find((x) => x.name === name).consultMinutes;
  const rows = [
    // each department starts at token 1 and continues independently
    [1, 'Manoj Kumar', 'General Medicine', 'Dr. Rahul Khanna', 'completed', 'normal', 70, 52],
    [2, 'Sunita Devi', 'Pediatrics', 'Dr. Meera Nair', 'completed', 'normal', 62, 48],
    [3, 'Arjun Bhatia', 'Orthopedics', 'Dr. Sanjay Gupta', 'completed', 'normal', 55, 38],
    [1, 'Fatima Begum', 'Cardiology', 'Dr. Aisha Verma', 'completed', 'urgent', 40, 22],
    [2, 'Ramesh Chandra', 'Cardiology', 'Dr. Aisha Verma', 'in-consultation', 'normal', 25, 5],
    [3, 'Priya Singh', 'Cardiology', 'Dr. Aisha Verma', 'waiting', 'normal', 22],
    [2, 'Amit Tiwari', 'General Medicine', 'Dr. Rahul Khanna', 'waiting', 'normal', 20],
    [1, 'Sana Khan', 'Pediatrics', 'Dr. Meera Nair', 'waiting', 'normal', 17],
    [2, 'Deepak Yadav', 'Orthopedics', 'Dr. Sanjay Gupta', 'waiting', 'normal', 14],
    [4, 'Anjali Mishra', 'Cardiology', 'Dr. Aisha Verma', 'waiting', 'urgent', 11],
    [1, 'Vivek Pandey', 'Neurology', 'Dr. Vikram Rao', 'waiting', 'normal', 9],
    [3, 'Kavya Joshi', 'General Medicine', 'Dr. Neha Kapoor', 'waiting', 'normal', 6],
    [1, 'Imran Ali', 'Gynecology', 'Dr. Farah Siddiqui', 'waiting', 'normal', 3],
  ];
  const reasons = ['Chest discomfort', 'Fever and cough', 'Fever for 3 days', 'Knee pain', 'Follow-up visit', 'Migraine', 'Routine check-up'];
  const sessionKey = new Date().toISOString().slice(0, 10);
  for (const [i, r] of rows.entries()) {
    const [tokenNumber, patientName, department, doctor, status, priority, createdMin, startedMin] = r;
    await QueueToken.create({
      tokenNumber, sessionKey, patientName, department, doctor, status, priority,
      reason: reasons[i % reasons.length],
      consultMinutes: d(department),
      createdAt: mins(createdMin),
      startedAt: startedMin !== undefined ? mins(startedMin) : undefined,
      completedAt: status === 'completed' ? mins(startedMin - 6) : undefined,
    });
  }

  for (const department of [...new Set(rows.map((row) => row[2]))]) {
    const numbers = rows.filter((row) => row[2] === department).map((row) => row[0]);
    await QueueCounter.findOneAndUpdate(
      { department, sessionKey },
      { $set: { lastTokenNumber: Math.max(...numbers) } },
      { upsert: true }
    );
  }
}

async function seedPharmacy() {
  if (await Medicine.countDocuments()) return;
  await Medicine.insertMany([
    { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', stock: 420, minStock: 100, price: 18, expiry: days(480) },
    { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotic', stock: 64, minStock: 80, price: 74, expiry: days(260) },
    { name: 'Azithromycin 250mg', genericName: 'Azithromycin', category: 'Antibiotic', stock: 150, minStock: 60, price: 96, expiry: days(390) },
    { name: 'Atorvastatin 20mg', genericName: 'Atorvastatin', category: 'Cardiac', stock: 210, minStock: 80, price: 112, expiry: days(540) },
    { name: 'Amlodipine 5mg', genericName: 'Amlodipine', category: 'Cardiac', stock: 38, minStock: 60, price: 42, expiry: days(300) },
    { name: 'Aspirin 75mg', genericName: 'Acetylsalicylic acid', category: 'Cardiac', stock: 305, minStock: 100, price: 12, expiry: days(610) },
    { name: 'Metformin 500mg', genericName: 'Metformin', category: 'Diabetes', stock: 180, minStock: 90, price: 28, expiry: days(420) },
    { name: 'Insulin Glargine', genericName: 'Insulin glargine', category: 'Diabetes', stock: 12, minStock: 25, unit: 'vials', price: 640, expiry: days(120) },
    { name: 'Salbutamol Inhaler', genericName: 'Salbutamol', category: 'Respiratory', stock: 0, minStock: 20, unit: 'inhalers', price: 168, expiry: days(350) },
    { name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamine', stock: 260, minStock: 70, price: 22, expiry: days(500) },
    { name: 'Pantoprazole 40mg', genericName: 'Pantoprazole', category: 'Gastro', stock: 95, minStock: 70, price: 58, expiry: days(430) },
    { name: 'ORS Sachets', genericName: 'Oral rehydration salts', category: 'Rehydration', stock: 520, minStock: 150, unit: 'sachets', price: 10, expiry: days(700) },
    { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesic', stock: 44, minStock: 80, price: 24, expiry: days(330) },
    { name: 'Normal Saline 500ml', genericName: 'Sodium chloride 0.9%', category: 'IV Fluids', stock: 140, minStock: 60, unit: 'bags', price: 48, expiry: days(400) },
  ]);
}

async function seedBeds() {
  if (await Bed.countDocuments()) return;
  const wards = [
    { ward: 'Emergency', type: 'Emergency', floor: 1, count: 10, occupied: 7, code: 'ER' },
    { ward: 'General Ward A', type: 'General', floor: 2, count: 12, occupied: 6, code: 'GA' },
    { ward: 'General Ward B', type: 'General', floor: 2, count: 12, occupied: 4, code: 'GB' },
    { ward: 'ICU', type: 'ICU', floor: 3, count: 10, occupied: 9, code: 'ICU' },
    { ward: 'Surgical Ward', type: 'Surgical', floor: 3, count: 10, occupied: 5, code: 'SU' },
    { ward: 'Maternity', type: 'Maternity', floor: 4, count: 10, occupied: 6, code: 'MT' },
    { ward: 'Pediatrics', type: 'Pediatrics', floor: 4, count: 10, occupied: 3, code: 'PD' },
  ];
  const docs = [];
  wards.forEach((w, wi) => {
    const order = Array.from({ length: w.count }, (_, i) => i).sort((a, b) => ((a * 37 + wi * 11) % 23) - ((b * 37 + wi * 11) % 23));
    const occ = new Set(order.slice(0, w.occupied));
    for (let i = 0; i < w.count; i++) {
      const busy = occ.has(i);
      docs.push({
        ward: w.ward, wardType: w.type, floor: w.floor,
        label: `${w.code}-${String(i + 1).padStart(2, '0')}`,
        status: busy ? 'occupied' : w.ward === 'General Ward A' && i === 0 ? 'cleaning' : 'available',
        patientName: busy ? NAMES[(i + wi * 3) % NAMES.length] : undefined,
        since: busy ? mins(60 * ((i % 7) + 1)) : undefined,
      });
    }
  });
  await Bed.insertMany(docs);
}

export async function seedIfEmpty() {
  await seedUsers();
  await seedQueue();
  await seedPharmacy();
  await seedBeds();
  console.log('Seed data ready. Demo accounts are documented in README.md.');
}
