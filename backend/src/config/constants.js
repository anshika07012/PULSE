// Shared hospital configuration used by the seed, queue and analytics modules.
export const DEPARTMENTS = [
  { name: 'General Medicine', capacity: 12, consultMinutes: 8 },
  { name: 'Cardiology', capacity: 8, consultMinutes: 15 },
  { name: 'Orthopedics', capacity: 8, consultMinutes: 12 },
  { name: 'Pediatrics', capacity: 10, consultMinutes: 10 },
  { name: 'Gynecology', capacity: 8, consultMinutes: 14 },
  { name: 'Neurology', capacity: 6, consultMinutes: 18 },
];

export const DOCTORS = [
  { name: 'Dr. Aisha Verma', department: 'Cardiology' },
  { name: 'Dr. Rahul Khanna', department: 'General Medicine' },
  { name: 'Dr. Meera Nair', department: 'Pediatrics' },
  { name: 'Dr. Sanjay Gupta', department: 'Orthopedics' },
  { name: 'Dr. Farah Siddiqui', department: 'Gynecology' },
  { name: 'Dr. Vikram Rao', department: 'Neurology' },
  { name: 'Dr. Neha Kapoor', department: 'General Medicine' },
];
