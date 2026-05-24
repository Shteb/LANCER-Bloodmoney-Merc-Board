const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const potrace = require('potrace');
const helpers = require('../helpers');
const dataStore = require('../models/dataStore');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: new Set(['image/png', 'image/jpeg', 'image/bmp'])
};

// File storage (Upload Emblem)
fs.mkdirSync(dataStore.getLogoArtDir(), { recursive: true });

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
    if (!FILE_UPLOAD.ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, and BMP images are allowed'));
    }
    cb(null, true);
  },
  limits: {
    files: 1,
    fileSize: FILE_UPLOAD.MAX_SIZE
  }
});

// Save uploaded Emblem files to logo_art + .svg conversion (overwrite-by-name)
router.post('/upload', (req, res) => {
  upload.single('myFile')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const base = helpers.sanitizeEmblemBaseName(req.file.originalname);
    if (!base) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // ignore
      }
      return res.status(400).json({ success: false, message: 'Invalid file name' });
    }

    const svgFilename = `${base}.svg`;
    const outputPath = path.join(dataStore.getLogoArtDir(), svgFilename);

    try {
      const svg = await new Promise((resolve, reject) => {
        potrace.trace(req.file.path, { threshold: 128 }, (traceErr, result) => {
          if (traceErr) return reject(traceErr);
          resolve(result);
        });
      });

      await fs.promises.writeFile(outputPath, svg, 'utf8');
      return res.json({
        success: true,
        emblem: svgFilename,
        url: `/emblems/${encodeURIComponent(svgFilename)}`
      });
    } catch (convertErr) {
      console.error(convertErr);
      return res.status(500).json({ success: false, message: 'SVG conversion failed' });
    } finally {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupErr) {
        if (cleanupErr && cleanupErr.code !== 'ENOENT') {
          console.error('Temp cleanup failed:', cleanupErr);
        }
      }
    }
  });
});

router.delete('/api/emblems/:filename', requireAdminAuth, async (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename
  if (!helpers.isSafeEmblemFilename(filename)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid emblem filename' 
    });
  }
  
  const emblemPath = path.join(dataStore.getLogoArtDir(), filename);
  
  // Check if emblem file exists
  if (!fs.existsSync(emblemPath)) {
    return res.status(404).json({ 
      success: false, 
      message: 'Emblem not found' 
    });
  }
  
  // Check if emblem is in use by any job or faction
  const jobs = dataStore.readJobs();
  const factions = dataStore.readFactions();
  const inUseByJob = jobs.some(job => job.emblem === filename);
  const inUseByFaction = factions.some(faction => faction.emblem === filename);
  if (inUseByJob || inUseByFaction) {
    return res.status(409).json({ 
      success: false, 
      message: 'Cannot delete emblem: it is currently in use by one or more jobs or factions' 
    });
  }
  
  // Delete the emblem file
  try {
    await fs.promises.unlink(emblemPath);
    res.json({ success: true, message: 'Emblem deleted successfully' });
  } catch (error) {
    console.error('Error deleting emblem:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete emblem file' 
    });
  }
});

module.exports = router;
