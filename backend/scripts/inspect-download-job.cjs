// Read-only delivery diagnostics. Never prints email addresses, tokens, or credentials.
const path = require('node:path');
const mongoose = require('mongoose');

async function main() {
  try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
  const uri = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('MONGODB_URL is missing. Run this script inside the production container.');
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const jobs = mongoose.connection.collection('collection_download_deliveries');
  const summary = await jobs.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).toArray();
  const recent = await jobs.find({}, { projection: {
    _id: 0, status: 1, fileCount: 1, createdAt: 1, readyAt: 1, expiresAt: 1,
    emailAttempts: 1, emailSentAt: 1, emailNextAttemptAt: 1,
  } }).sort({ createdAt: -1 }).limit(10).toArray();
  const failures = await jobs.aggregate([
    { $match: { lastError: { $ne: '' } } },
    { $project: { category: { $switch: { branches: [
      { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /SMTP.*NOT.CONFIGURED|SMTP is not configured/i } }, then: 'SMTP_NOT_CONFIGURED' },
      { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /SMTP|email delivery/i } }, then: 'EMAIL_DELIVERY_FAILED' },
      { case: { $regexMatch: { input: { $ifNull: ['$lastError', ''] }, regex: /interrupt|recover/i } }, then: 'WORKER_INTERRUPTED' },
    ], default: 'FILE_PREPARATION_FAILED' } } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]).toArray();
  console.log(JSON.stringify({ summary, failures, recent }, null, 2));
}

main().catch(() => {
  console.error('Read-only download diagnostics failed. Check database configuration and connectivity.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
