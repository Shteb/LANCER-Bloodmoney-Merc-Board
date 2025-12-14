const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/emblems', express.static('logo_art'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Data file paths
const DATA_FILE = path.join(__dirname, 'data', 'jobs.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize settings file with default data if it doesn't exist
function initializeSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      portalHeading: 'HERM00R MERCENARY PORTAL',
      unt: new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY format
      currentGalacticPos: 'UNKNOWN_SECTOR',
      colorScheme: 'grey',
      userGroup: 'FREELANCE_OPERATORS'
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
}

// Initialize data file with dummy data if it doesn't exist
function initializeData() {
  if (!fs.existsSync(DATA_FILE)) {
    const dummyJobs = [
      {
        id: '1',
        name: 'Lorem Ipsum Dolorem',
        rank: 2,
        client: 'Consectetur Corporation',
        jobType: 'Finibus bonorum',
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        clientBrief: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        currencyPay: '150m',
        additionalPay: 'Duis aute irure dolor in reprehenderit',
        emblem: 'birds.svg'
      },
      {
        id: '2',
        name: 'Sit Amet Consectetur',
        rank: 1,
        client: 'Adipiscing Industries',
        jobType: 'Malorum extrema',
        description: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        clientBrief: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
        currencyPay: '75m',
        additionalPay: 'Totam rem aperiam',
        emblem: 'sun.svg'
      },
      {
        id: '3',
        name: 'Tempor Incididunt',
        rank: 3,
        client: 'Eiusmod Enterprises',
        jobType: 'Ratione voluptatem',
        description: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.',
        clientBrief: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
        currencyPay: '250m',
        additionalPay: 'Sed quia non numquam eius modi tempora',
        emblem: 'triangle.svg'
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(dummyJobs, null, 2));
  }
}

// Read jobs from file
function readJobs() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write jobs to file
function writeJobs(jobs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
}

// Read settings from file
function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    // Ensure settings have the expected structure
    return {
      portalHeading: settings.portalHeading || 'HERM00R MERCENARY PORTAL',
      unt: settings.unt || '',
      currentGalacticPos: settings.currentGalacticPos || '',
      colorScheme: settings.colorScheme || 'grey',
      userGroup: settings.userGroup || 'FREELANCE_OPERATORS'
    };
  } catch (error) {
    // Handle file not found or JSON parse errors gracefully
    return { portalHeading: 'HERM00R MERCENARY PORTAL', unt: '', currentGalacticPos: '', colorScheme: 'grey', userGroup: 'FREELANCE_OPERATORS' };
  }
}

// Write settings to file
function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// File storage (Upload Emblem)
const multer = require('multer');
const potrace = require('potrace');

const uploadDir = path.join(__dirname, 'logo_art');
fs.mkdirSync(uploadDir, { recursive: true });

const tmpUploadDir = path.join(__dirname, 'data', 'uploads_tmp');
fs.mkdirSync(tmpUploadDir, { recursive: true });

function sanitizeEmblemBaseName(originalName) {
  const normalized = String(originalName || '').replace(/\\/g, '/');
  const base = path.posix.parse(normalized).name;

  const safe = base
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!safe) return null;

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  return reserved.test(safe) ? `_${safe}` : safe;
}

function isSafeEmblemFilename(filename) {
  if (typeof filename !== 'string') return false;
  if (filename !== path.basename(filename)) return false;
  return /^[A-Za-z0-9_-]+\.svg$/.test(filename);
}

function validateEmblem(emblem) {
  if (emblem && emblem !== '') {
    if (!isSafeEmblemFilename(emblem) || !fs.existsSync(path.join(uploadDir, emblem))) {
      return { valid: false, message: 'Invalid emblem selection' };
    }
  }
  return { valid: true };
}

function formatEmblemTitle(filename) {
  return filename.replace('.svg', '').replace(/_/g, ' ');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tmpUploadDir),
  filename: (req, file, cb) => {
    const normalized = String(file.originalname || '').replace(/\\/g, '/');
    const ext = path.posix.extname(normalized).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext || ''}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/bmp']);
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, and BMP images are allowed'));
    }
    cb(null, true);
  },
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Save uploaded Emblem files to logo_art + .svg conversion (overwrite-by-name)
app.post('/upload', (req, res) => {
  upload.single('myFile')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const base = sanitizeEmblemBaseName(req.file.originalname);
    if (!base) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // ignore
      }
      return res.status(400).json({ success: false, message: 'Invalid file name' });
    }

    const svgFilename = `${base}.svg`;
    const outputPath = path.join(uploadDir, svgFilename);

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

// Initialize data on startup
initializeData();
initializeSettings();

// Routes
app.get('/', (req, res) => {
  const settings = readSettings();
  res.render('landing', { error: req.query.error, colorScheme: settings.colorScheme, settings });
});

app.post('/authenticate', (req, res) => {
  const password = req.body.password;
  if (password === 'IMHOTEP') {
    res.redirect('/client');
  } else if (password === 'TARASQUE') {
    res.redirect('/admin');
  } else {
    res.redirect('/?error=invalid');
  }
});

app.get('/client', (req, res) => {
  const jobs = readJobs();
  const settings = readSettings();
  res.render('client', { jobs, settings, colorScheme: settings.colorScheme });
});

app.get('/admin', (req, res) => {
  const jobs = readJobs();
  const settings = readSettings();
  const emblemFiles = fs.readdirSync(path.join(__dirname, 'logo_art'))
    .filter(file => file.endsWith('.svg'))
    .sort();
  res.render('admin', { jobs, settings, emblems: emblemFiles, formatEmblemTitle });
});

// API endpoints for admin operations
app.post('/api/jobs', (req, res) => {
  const jobs = readJobs();
  const emblem = req.body.emblem;
  const validation = validateEmblem(emblem);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  const newJob = {
    id: crypto.randomUUID(),
    name: req.body.name,
    rank: parseInt(req.body.rank),
    client: req.body.client,
    jobType: req.body.jobType,
    description: req.body.description,
    clientBrief: req.body.clientBrief,
    currencyPay: req.body.currencyPay,
    additionalPay: req.body.additionalPay,
    emblem: emblem
  };
  jobs.push(newJob);
  writeJobs(jobs);
  res.json({ success: true, job: newJob });
});

app.put('/api/jobs/:id', (req, res) => {
  const jobs = readJobs();
  const index = jobs.findIndex(j => j.id === req.params.id);
  if (index !== -1) {
    const emblem = req.body.emblem;
    const validation = validateEmblem(emblem);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    jobs[index] = {
      id: req.params.id,
      name: req.body.name,
      rank: parseInt(req.body.rank),
      client: req.body.client,
      jobType: req.body.jobType,
      description: req.body.description,
      clientBrief: req.body.clientBrief,
      currencyPay: req.body.currencyPay,
      additionalPay: req.body.additionalPay,
      emblem: emblem
    };
    writeJobs(jobs);
    res.json({ success: true, job: jobs[index] });
  } else {
    res.status(404).json({ success: false, message: 'Job not found' });
  }
});

app.delete('/api/jobs/:id', (req, res) => {
  let jobs = readJobs();
  jobs = jobs.filter(j => j.id !== req.params.id);
  writeJobs(jobs);
  res.json({ success: true });
});

// API endpoints for settings
app.get('/api/settings', (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const portalHeading = req.body.portalHeading ?? '';
  const unt = req.body.unt ?? '';
  const currentGalacticPos = req.body.currentGalacticPos ?? '';
  const colorScheme = req.body.colorScheme || 'grey';
  const userGroup = req.body.userGroup ?? '';
  
  // Validate portal heading (max length 100 characters)
  const trimmedPortalHeading = (typeof portalHeading === 'string' ? portalHeading : '').trim();
  if (trimmedPortalHeading.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Portal Heading cannot be empty' 
    });
  }
  if (trimmedPortalHeading.length > 100) {
    return res.status(400).json({ 
      success: false, 
      message: 'Portal Heading must be 100 characters or less' 
    });
  }
  
  // Validate color scheme
  const validColorSchemes = ['grey', 'orange', 'green', 'blue'];
  if (!validColorSchemes.includes(colorScheme)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid color scheme. Must be one of: grey, orange, green, blue' 
    });
  }
  
  // Validate userGroup (max length 100 characters)
  const trimmedUserGroup = (typeof userGroup === 'string' ? userGroup : '').trim();
  if (trimmedUserGroup.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'User Group cannot be empty' 
    });
  }
  if (trimmedUserGroup.length > 100) {
    return res.status(400).json({ 
      success: false, 
      message: 'User Group must be 100 characters or less' 
    });
  }
  
  // Validate UNT date format (DD/MM/YYYY)
  const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
  if (unt && !datePattern.test(unt)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid date format. Use DD/MM/YYYY' 
    });
  }
  
  // Validate date values if provided
  if (unt && datePattern.test(unt)) {
    const [day, month, year] = unt.split('/').map(Number);
    if (month < 1 || month > 12 || day < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date values. Day must be at least 1, month must be 1-12' 
      });
    }
    
    // Check days per month
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Check for leap year
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (month === 2 && isLeapYear) {
      daysInMonth[1] = 29;
    }
    
    if (day > daysInMonth[month - 1]) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid day for month ${month}. Maximum is ${daysInMonth[month - 1]} days.`
      });
    }
  }
  
  const settings = {
    portalHeading: trimmedPortalHeading,
    unt: unt.trim(),
    currentGalacticPos: currentGalacticPos.trim(),
    colorScheme: colorScheme,
    userGroup: trimmedUserGroup
  };
  
  writeSettings(settings);
  res.json({ success: true, settings });
});

// API endpoint to delete emblem
app.delete('/api/emblems/:filename', async (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename
  if (!isSafeEmblemFilename(filename)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid emblem filename' 
    });
  }
  
  const emblemPath = path.join(uploadDir, filename);
  
  // Check if emblem file exists
  if (!fs.existsSync(emblemPath)) {
    return res.status(404).json({ 
      success: false, 
      message: 'Emblem not found' 
    });
  }
  
  // Check if emblem is in use by any job
  const jobs = readJobs();
  const inUse = jobs.some(job => job.emblem === filename);
  if (inUse) {
    return res.status(409).json({ 
      success: false, 
      message: 'Cannot delete emblem: it is currently in use by one or more jobs' 
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
