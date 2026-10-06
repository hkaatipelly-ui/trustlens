import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.info('MongoDB connected');
  } catch (cause) {
    throw new Error(
      'Unable to connect to MongoDB. Check MONGODB_URI, Atlas credentials, and Network Access.',
      { cause },
    );
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
