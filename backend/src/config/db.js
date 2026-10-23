import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

export async function connectDB() {
  let uri = process.env.MONGODB_URI;

  if (!uri) {
    // Zero-setup mode: start an embedded MongoDB that stores data in ./.data
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.resolve('.data');
    fs.mkdirSync(dbPath, { recursive: true });
    const mongod = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger' },
    });
    uri = mongod.getUri('pulse');
    console.log('Using embedded MongoDB (data saved in backend/.data)');
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
