const express = require('express');
const fs = require('fs');
const path = require('path');
const potrace = require('potrace');
const helpers = require('../helpers');
const dataStore = require('../models/dataStore');
const { requireAdminAuth } = require('../middleware/auth');
const { upload } = require('../lib/imageUpload');

const router = express.Router();

// File storage (Upload Emblem)
fs.mkdirSync(dataStore.getLogoArtDir(), { recursive: true });

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
  
  // Check if emblem is in use by any job, faction, or theater location icon
  const jobs = dataStore.readJobs();
  const factions = dataStore.readFactions();
  const theaters = dataStore.readTheaters();
  const inUseByJob = jobs.some(job => job.emblem === filename);
  const inUseByFaction = factions.some(faction => faction.emblem === filename);
  const inUseByLocation = theaters.some(theater =>
    (theater.locations || []).some(loc => loc.icon === filename)
  );
  if (inUseByJob || inUseByFaction || inUseByLocation) {
    return res.status(409).json({
      success: false,
      message: 'Cannot delete emblem: it is currently in use by one or more jobs, factions, or locations'
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
