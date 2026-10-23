import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { app } from '../server.js';
import User from '../src/models/User.js';
import QueueToken from '../src/models/QueueToken.js';
import QueueCounter from '../src/models/QueueCounter.js';

let mongod;
let server;
let baseUrl;
let patientToken;
let cardioDoctorToken;
let medicineDoctorToken;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  return { response, body };
}

async function auth(email, password, role) {
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
  assert.equal(response.status, 200);
  return body.token;
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash('test-password', 10);
  await User.create([
    { name: 'Test Patient', email: 'patient@test.local', passwordHash, role: 'patient' },
    { name: 'Dr. Cardio', email: 'cardio@test.local', passwordHash, role: 'doctor', department: 'Cardiology', licenseId: 'TEST-CARDIO' },
    { name: 'Dr. Medicine', email: 'medicine@test.local', passwordHash, role: 'doctor', department: 'General Medicine', licenseId: 'TEST-MEDICINE' },
  ]);
}

before(async () => {
  process.env.JWT_SECRET = 'test-only-secret';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('pulse-test'));
  await seedUsers();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  patientToken = await auth('patient@test.local', 'test-password', 'patient');
  cardioDoctorToken = await auth('cardio@test.local', 'test-password', 'doctor');
  medicineDoctorToken = await auth('medicine@test.local', 'test-password', 'doctor');
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
});

test('department token numbers are independent and emergency tokens stay separate', async () => {
  const cardio = await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
    body: JSON.stringify({ department: 'Cardiology', doctor: 'Dr. Cardio', patientName: 'Cardio Patient 1' }),
  });
  const medicine = await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${medicineDoctorToken}` },
    body: JSON.stringify({ department: 'General Medicine', doctor: 'Dr. Medicine', patientName: 'Medicine Patient 1' }),
  });
  const emergency = await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
    body: JSON.stringify({ department: 'Cardiology', doctor: 'Dr. Cardio', patientName: 'Emergency Cardio', emergency: true }),
  });

  assert.equal(cardio.response.status, 201);
  assert.equal(medicine.response.status, 201);
  assert.equal(emergency.response.status, 201);
  assert.equal(cardio.body.token.tokenNumber, 1);
  assert.equal(medicine.body.token.tokenNumber, 1);
  assert.equal(emergency.body.token.priority, 'emergency');
  assert.equal(cardio.body.tokens.some((token) => token.patientName === 'Emergency Cardio'), false);
});

test('position and wait are computed only from the selected department queue', async () => {
  await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
    body: JSON.stringify({ department: 'Cardiology', doctor: 'Dr. Cardio', patientName: 'Cardio Patient 2', priority: 'urgent' }),
  });
  const laterCardio = await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
    body: JSON.stringify({ department: 'Cardiology', doctor: 'Dr. Cardio', patientName: 'Cardio Patient 3' }),
  });
  const medicine = await request('/api/queue?department=General%20Medicine', {
    headers: { Authorization: `Bearer ${medicineDoctorToken}` },
  });
  const cardio = await request('/api/queue?department=Cardiology', {
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
  });

  assert.equal(laterCardio.body.token.tokenNumber, 4);
  assert.equal(cardio.body.tokens.length >= 3, true);
  assert.equal(medicine.body.tokens.every((token) => token.department === 'General Medicine'), true);
  assert.equal(cardio.body.tokens.every((token) => token.department === 'Cardiology'), true);

  const urgent = cardio.body.tokens.find((token) => token.patientName === 'Cardio Patient 2');
  const normal = cardio.body.tokens.find((token) => token.patientName === 'Cardio Patient 3');
  assert.equal(urgent.position, 1);
  assert.equal(normal.position, 3);
  assert.equal(normal.estimatedWaitMin, 15);
});

test('cancelled and completed tokens do not count as patients ahead', async () => {
  const before = await request('/api/queue?department=Cardiology', {
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
  });
  const cancelled = before.body.tokens.find((token) => token.patientName === 'Cardio Patient 1');
  const completed = before.body.tokens.find((token) => token.patientName === 'Cardio Patient 2');
  await request(`/api/queue/${cancelled._id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  await request(`/api/queue/${completed._id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
    body: JSON.stringify({ status: 'completed' }),
  });
  const afterCancel = await request('/api/queue?department=Cardiology', {
    headers: { Authorization: `Bearer ${cardioDoctorToken}` },
  });
  const target = afterCancel.body.tokens.find((token) => token.patientName === 'Cardio Patient 3');

  assert.equal(afterCancel.body.tokens.some((token) => token._id === cancelled._id), true);
  assert.equal(afterCancel.body.tokens.some((token) => token._id === completed._id), true);
  assert.equal(afterCancel.body.tokens.find((token) => token._id === completed._id).status, 'completed');
  assert.equal(target.position, 1);
  assert.equal(target.estimatedWaitMin, 1);
});

test('doctors cannot access or mutate another department queue', async () => {
  const deniedCreate = await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${medicineDoctorToken}` },
    body: JSON.stringify({ department: 'Cardiology', doctor: 'Dr. Cardio', patientName: 'Wrong Dept' }),
  });
  const cardio = await QueueToken.findOne({ department: 'Cardiology', status: 'waiting' }).lean();
  const deniedStatus = await request(`/api/queue/${cardio._id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${medicineDoctorToken}` },
    body: JSON.stringify({ status: 'completed' }),
  });

  assert.equal(deniedCreate.response.status, 403);
  assert.equal(deniedStatus.response.status, 403);
});

test('invalid doctor login and patient emergency request are rejected', async () => {
  const invalid = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'cardio@test.local', password: 'wrong-password', role: 'doctor' }),
  });
  const wrongPortal = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'cardio@test.local', password: 'test-password', role: 'patient' }),
  });
  const emergency = await request('/api/queue', {
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` },
    body: JSON.stringify({ department: 'Cardiology', doctor: 'Dr. Cardio', emergency: true }),
  });

  assert.equal(invalid.response.status, 401);
  assert.equal(wrongPortal.response.status, 403);
  assert.equal(emergency.response.status, 403);
});

test('database prevents duplicate department session token numbers', async () => {
  const sessionKey = '2099-01-01';
  await QueueCounter.create({ department: 'Cardiology', sessionKey, lastTokenNumber: 99 });
  await QueueToken.create({
    tokenNumber: 99,
    sessionKey,
    patientName: 'Duplicate One',
    department: 'Cardiology',
    doctor: 'Dr. Cardio',
  });
  await assert.rejects(() => QueueToken.create({
    tokenNumber: 99,
    sessionKey,
    patientName: 'Duplicate Two',
    department: 'Cardiology',
    doctor: 'Dr. Cardio',
  }));
});
