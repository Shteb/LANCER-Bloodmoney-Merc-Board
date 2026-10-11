const express = require('express');
const fs = require('fs');
const path = require('path');
const helpers = require('../helpers');
const dataStore = require('../models/dataStore');
const { requireAdminAuth } = require('../middleware/auth');
const { upload } = require('../lib/imageUpload');
const { broadcastTheaters } = require('../lib/theaterBroadcast');

const router = express.Router();

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.bmp']);

fs.mkdirSync(dataStore.getTheaterAssetsDir(), { recursive: true });

// List all uploaded theater background images (admin only).
// Returns [{ filename, inUse }] so the gallery can flag in-use assets.
router.get('/api/theater-assets', requireAdminAuth, (req, res) => {
  const dir = dataStore.getTheaterAssetsDir();
  let files = [];
  try {
    files = fs.readdirSync(dir)
      .filter(f => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
      .sort();
  } catch (e) {
    files = [];
  }

  const theaters = dataStore.readTheaters();
  const usedSet = new Set(theaters.map(t => t.backgroundImage).filter(Boolean));

  res.json(files.map(filename => ({
    filename,
    inUse: usedSet.has(filename)
  })));
});

// Upload theater background (flat map): move the validated temp file into
// the theater assets dir under a generated name.
router.post('/upload/theater-background', requireAdminAuth, (req, res) => {
  upload.single('myFile')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      try { await fs.promises.unlink(req.file.path); } catch { /* ignore */ }
      return res.status(400).json({ success: false, message: 'Invalid file extension' });
    }

    const filename = `${helpers.generateId()}${ext}`;
    const outputPath = path.join(dataStore.getTheaterAssetsDir(), filename);

    try {
      await fs.promises.rename(req.file.path, outputPath);
      return res.json({ success: true, backgroundImage: filename });
    } catch (moveErr) {
      console.error('Theater asset move failed:', moveErr);
      try { await fs.promises.unlink(req.file.path); } catch { /* ignore */ }
      return res.status(500).json({ success: false, message: 'Failed to store uploaded file' });
    }
  });
});

// Delete theater background. An in-use image can still be deleted; the
// reference is cleared from any theater using it first.
router.delete('/api/theater-assets/:filename', requireAdminAuth, async (req, res) => {
  const filename = req.params.filename;
  if (!helpers.isSafeImageFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  const filePath = path.join(dataStore.getTheaterAssetsDir(), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Asset not found' });
  }

  const theaters = dataStore.readTheaters();
  let changed = false;
  theaters.forEach(t => {
    if (t.backgroundImage === filename) {
      t.backgroundImage = null;
      changed = true;
    }
  });
  if (changed) {
    dataStore.writeTheaters(theaters);
    broadcastTheaters({ action: 'update', theaters });
  }

  try {
    await fs.promises.unlink(filePath);
    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting theater asset:', error);
    res.status(500).json({ success: false, message: 'Failed to delete asset' });
  }
});

module.exports = router;
