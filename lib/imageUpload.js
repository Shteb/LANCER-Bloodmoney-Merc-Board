// Shared multer configuration for admin image uploads (emblems, theater maps).
// Files land in a temp dir under the data dir; each route decides where the
// validated file finally goes.
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const helpers = require('../helpers');
const dataStore = require('../models/dataStore');

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/bmp']);

const tmpUploadDir = path.join(dataStore.getDataDir(), 'uploads_tmp');
fs.mkdirSync(tmpUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tmpUploadDir),
  filename: (req, file, cb) => {
    const normalized = String(file.originalname || '').replace(/\\/g, '/');
    const ext = path.posix.extname(normalized).toLowerCase();
    cb(null, `${helpers.generateId()}${ext || ''}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, and BMP images are allowed'));
    }
    cb(null, true);
  },
  limits: { files: 1, fileSize: MAX_SIZE }
});

module.exports = { upload, tmpUploadDir, MAX_SIZE, ALLOWED_TYPES };
