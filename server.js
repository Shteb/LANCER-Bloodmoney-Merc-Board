const express = require('express');
const path = require('path');
const fs = require('fs');
const helpers = require('./helpers');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const PASSWORDS = {
  CLIENT: 'IMHOTEP',
  ADMIN: 'TARASQUE'
};

const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: new Set(['image/png', 'image/jpeg', 'image/bmp'])
};

const BASE_MODULES = {
  CORE_COUNT: 3,
  MAJOR_COUNT: 6,
  MINOR_COUNT: 6,
  TOTAL_COUNT: 15
};

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
const MANNA_FILE = path.join(__dirname, 'data', 'manna.json');
const BASE_FILE = path.join(__dirname, 'data', 'base.json');
const FACTIONS_FILE = path.join(__dirname, 'data', 'factions.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize settings file with default data if it doesn't exist
function initializeSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      ...DEFAULT_SETTINGS,
      unt: '01/01/5025',
      currentGalacticPos: 'SKAER-5'
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

// Default settings object
const DEFAULT_SETTINGS = {
  portalHeading: 'HERM00R MERCENARY PORTAL',
  unt: '',
  currentGalacticPos: '',
  colorScheme: 'grey',
  userGroup: 'FREELANCE_OPERATORS'
};

// Read settings from file
function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    // Merge with defaults to ensure all required fields exist
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

// Write settings to file
function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Initialize Manna data
function initializeManna() {
  if (!fs.existsSync(MANNA_FILE)) {
    const defaultManna = {
      balance: 1500,
      transactions: [
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 500,
          description: 'Contract completion bonus',
          balance: 1000
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          amount: -200,
          description: 'Equipment maintenance costs',
          balance: 800
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 750,
          description: 'Mission payment received',
          balance: 1550
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          amount: -50,
          description: 'Docking fees',
          balance: 1500
        }
      ]
    };
    fs.writeFileSync(MANNA_FILE, JSON.stringify(defaultManna, null, 2));
  }
}

// Read Manna data
function readManna() {
  try {
    const data = fs.readFileSync(MANNA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { balance: 0, transactions: [] };
  }
}

// Write Manna data
function writeManna(manna) {
  fs.writeFileSync(MANNA_FILE, JSON.stringify(manna, null, 2));
}

// Initialize Base modules
function initializeBase() {
  if (!fs.existsSync(BASE_FILE)) {
    const defaultBase = {
      modules: [
        // 3 Core modules - at least one partially filled
        { type: 'Core', title: 'Primary Systems', description: 'Main operational systems and life support infrastructure', disabled: false },
        { type: 'Core', title: '', description: '', disabled: false },
        { type: 'Core', title: '', description: '', disabled: false },
        // 6 Major modules - at least one partially filled
        { type: 'Major', title: 'Defense Grid', description: 'Automated perimeter defense and surveillance systems', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        // 6 Minor modules (last 2 disabled by default) - at least one partially filled
        { type: 'Minor', title: 'Recreation Bay', description: 'Common area for crew rest and relaxation', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: true },
        { type: 'Minor', title: '', description: '', disabled: true }
      ]
    };
    fs.writeFileSync(BASE_FILE, JSON.stringify(defaultBase, null, 2));
  }
}

// Read Base data
function readBase() {
  try {
    const data = fs.readFileSync(BASE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    initializeBase();
    return readBase();
  }
}

// Write Base data
function writeBase(base) {
  fs.writeFileSync(BASE_FILE, JSON.stringify(base, null, 2));
}

// Initialize Factions
function initializeFactions() {
  if (!fs.existsSync(FACTIONS_FILE)) {
    const defaultFactions = [
      {
        id: '1',
        title: 'Conglomerate Finibus',
        emblem: 'construction.svg',
        brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        standing: 2,
        jobsCompleted: 3,
        jobsFailed: 1
      },
      {
        id: '2',
        title: 'Shimano Industries',
        emblem: 'cosmetics.svg',
        brief: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        standing: 3,
        jobsCompleted: 5,
        jobsFailed: 0
      },
      {
        id: '3',
        title: 'Collective Malorum',
        emblem: 'engineering.svg',
        brief: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
        standing: 1,
        jobsCompleted: 1,
        jobsFailed: 2
      }
    ];
    fs.writeFileSync(FACTIONS_FILE, JSON.stringify(defaultFactions, null, 2));
  }
}

// Read Factions
function readFactions() {
  try {
    const data = fs.readFileSync(FACTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write Factions
function writeFactions(factions) {
  fs.writeFileSync(FACTIONS_FILE, JSON.stringify(factions, null, 2));
}

// File storage (Upload Emblem)
const multer = require('multer');
const potrace = require('potrace');

const uploadDir = path.join(__dirname, 'logo_art');
fs.mkdirSync(uploadDir, { recursive: true });

const tmpUploadDir = path.join(__dirname, 'data', 'uploads_tmp');
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
app.post('/upload', (req, res) => {
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
initializeManna();
initializeBase();
initializeFactions();

// Routes
app.get('/', (req, res) => {
  const settings = readSettings();
  res.render('landing', { error: req.query.error, colorScheme: settings.colorScheme, settings });
});

app.post('/authenticate', (req, res) => {
  const password = req.body.password;
  if (password === PASSWORDS.CLIENT) {
    res.redirect('/client/overview');
  } else if (password === PASSWORDS.ADMIN) {
    res.redirect('/admin');
  } else {
    res.redirect('/?error=invalid');
  }
});

// Client routes
app.get('/client', (req, res) => {
  res.redirect('/client/overview');
});

app.get('/client/overview', (req, res) => {
  const settings = readSettings();
  const manna = readManna();
  // Get last 5 transactions
  const recentTransactions = manna.transactions.slice(-5).reverse();
  res.render('client-overview', { settings, colorScheme: settings.colorScheme, manna, recentTransactions });
});

app.get('/client/finances', (req, res) => {
  const settings = readSettings();
  const manna = readManna();
  res.render('client-finances', { settings, colorScheme: settings.colorScheme, manna });
});

app.get('/client/jobs', (req, res) => {
  const jobs = readJobs();
  const settings = readSettings();
  res.render('client-jobs', { jobs, settings, colorScheme: settings.colorScheme });
});

app.get('/client/base', (req, res) => {
  const settings = readSettings();
  const base = readBase();
  res.render('client-base', { settings, colorScheme: settings.colorScheme, base });
});

app.get('/client/factions', (req, res) => {
  const settings = readSettings();
  const factions = readFactions();
  res.render('client-factions', { settings, colorScheme: settings.colorScheme, factions });
});

app.get('/admin', (req, res) => {
  const jobs = readJobs();
  const settings = readSettings();
  const manna = readManna();
  const base = readBase();
  const factions = readFactions();
  const emblemFiles = fs.readdirSync(path.join(__dirname, 'logo_art'))
    .filter(file => file.endsWith('.svg'))
    .sort();
  res.render('admin', { jobs, settings, manna, base, factions, emblems: emblemFiles, formatEmblemTitle: helpers.formatEmblemTitle });
});

// API endpoints for admin operations
app.post('/api/jobs', (req, res) => {
  const jobs = readJobs();
  const emblem = req.body.emblem;
  const validation = helpers.validateEmblem(emblem, uploadDir);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  const newJob = {
    id: helpers.generateId(),
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
    const validation = helpers.validateEmblem(emblem, uploadDir);
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
  // Validate portal heading
  const headingValidation = helpers.validateRequiredString(req.body.portalHeading, 'Portal Heading', 100);
  if (!headingValidation.valid) {
    return res.status(400).json({ success: false, message: headingValidation.message });
  }
  
  // Validate color scheme
  const colorScheme = req.body.colorScheme || 'grey';
  if (!helpers.isValidColorScheme(colorScheme)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid color scheme. Must be one of: ${helpers.VALID_COLOR_SCHEMES.join(', ')}` 
    });
  }
  
  // Validate user group
  const userGroupValidation = helpers.validateRequiredString(req.body.userGroup, 'User Group', 100);
  if (!userGroupValidation.valid) {
    return res.status(400).json({ success: false, message: userGroupValidation.message });
  }
  
  // Validate UNT date format
  const unt = req.body.unt ?? '';
  const dateValidation = helpers.validateDate(unt);
  if (!dateValidation.valid) {
    return res.status(400).json({ success: false, message: dateValidation.message });
  }
  
  const settings = {
    portalHeading: headingValidation.value,
    unt: unt.trim(),
    currentGalacticPos: (req.body.currentGalacticPos ?? '').trim(),
    colorScheme: colorScheme,
    userGroup: userGroupValidation.value
  };
  
  writeSettings(settings);
  res.json({ success: true, settings });
});

// API endpoint to delete emblem
app.delete('/api/emblems/:filename', async (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename
  if (!helpers.isSafeEmblemFilename(filename)) {
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
  
  // Check if emblem is in use by any job or faction
  const jobs = readJobs();
  const factions = readFactions();
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

// Manna API endpoints
app.get('/api/manna', (req, res) => {
  const manna = readManna();
  res.json(manna);
});

app.put('/api/manna', (req, res) => {
  // Validate balance parameter
  if (req.body.balance === undefined || req.body.balance === null) {
    return res.status(400).json({ 
      success: false, 
      message: 'Balance is required' 
    });
  }
  
  const balance = parseInt(req.body.balance);
  if (isNaN(balance)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Balance must be a valid number' 
    });
  }
  
  const description = req.body.description || '';
  const amount = parseInt(req.body.amount) || 0;
  
  const manna = readManna();
  manna.balance = balance;
  
  // Add transaction if amount is provided
  if (amount !== 0 && description) {
    manna.transactions.push({
      id: helpers.generateId(),
      date: new Date().toISOString(),
      amount: amount,
      description: description,
      balance: balance
    });
  }
  
  writeManna(manna);
  res.json({ success: true, manna });
});

app.post('/api/manna/transaction', (req, res) => {
  const amount = parseInt(req.body.amount) || 0;
  const description = req.body.description || '';
  
  if (!description.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Transaction description is required' 
    });
  }
  
  const manna = readManna();
  manna.balance += amount;
  
  manna.transactions.push({
    id: helpers.generateId(),
    date: new Date().toISOString(),
    amount: amount,
    description: description.trim(),
    balance: manna.balance
  });
  
  writeManna(manna);
  res.json({ success: true, manna });
});

app.put('/api/manna/transaction/:id', (req, res) => {
  const manna = readManna();
  const transactionIndex = manna.transactions.findIndex(t => t.id === req.params.id);
  
  if (transactionIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: 'Transaction not found' 
    });
  }
  
  // Validate inputs
  const amount = parseInt(req.body.amount);
  const description = req.body.description || '';
  const date = req.body.date;
  
  if (isNaN(amount)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Amount must be a valid number' 
    });
  }
  
  if (!description.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Transaction description is required' 
    });
  }
  
  if (!date) {
    return res.status(400).json({ 
      success: false, 
      message: 'Transaction date is required' 
    });
  }
  
  // Update transaction preserving balance
  manna.transactions[transactionIndex] = {
    id: req.params.id,
    date: date,
    amount: amount,
    description: description.trim(),
    balance: manna.transactions[transactionIndex].balance // Keep original balance
  };
  
  writeManna(manna);
  res.json({ success: true, transaction: manna.transactions[transactionIndex] });
});

app.delete('/api/manna/transaction/:id', (req, res) => {
  const manna = readManna();
  const transactionIndex = manna.transactions.findIndex(t => t.id === req.params.id);
  
  if (transactionIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: 'Transaction not found' 
    });
  }
  
  // Remove the transaction without affecting the balance
  manna.transactions.splice(transactionIndex, 1);
  
  writeManna(manna);
  res.json({ success: true });
});

// Base API endpoints
app.get('/api/base', (req, res) => {
  const base = readBase();
  res.json(base);
});

app.put('/api/base', (req, res) => {
  const modules = req.body.modules;
  
  if (!Array.isArray(modules) || modules.length !== BASE_MODULES.TOTAL_COUNT) {
    return res.status(400).json({ 
      success: false, 
      message: `Base must have exactly ${BASE_MODULES.TOTAL_COUNT} modules` 
    });
  }
  
  writeBase({ modules });
  res.json({ success: true, base: { modules } });
});

// Factions API endpoints
app.get('/api/factions', (req, res) => {
  const factions = readFactions();
  res.json(factions);
});

app.post('/api/factions', (req, res) => {
  // Validate title
  const titleValidation = helpers.validateRequiredString(req.body.title, 'Faction title');
  if (!titleValidation.valid) {
    return res.status(400).json({ success: false, message: titleValidation.message });
  }
  
  // Validate brief
  const briefValidation = helpers.validateRequiredString(req.body.brief, 'Faction brief');
  if (!briefValidation.valid) {
    return res.status(400).json({ success: false, message: briefValidation.message });
  }
  
  // Validate emblem
  const emblem = req.body.emblem;
  const emblemValidation = helpers.validateEmblem(emblem, uploadDir);
  if (!emblemValidation.valid) {
    return res.status(400).json({ success: false, message: emblemValidation.message });
  }
  
  // Validate standing
  const standingValidation = helpers.validateInteger(req.body.standing, 'Standing', 0, 4);
  if (!standingValidation.valid) {
    return res.status(400).json({ success: false, message: standingValidation.message });
  }
  
  const factions = readFactions();
  const newFaction = {
    id: helpers.generateId(),
    title: titleValidation.value,
    emblem: emblem,
    brief: briefValidation.value,
    standing: standingValidation.value,
    jobsCompleted: parseInt(req.body.jobsCompleted) || 0,
    jobsFailed: parseInt(req.body.jobsFailed) || 0
  };
  factions.push(newFaction);
  writeFactions(factions);
  res.json({ success: true, faction: newFaction });
});

app.put('/api/factions/:id', (req, res) => {
  const factions = readFactions();
  const index = factions.findIndex(f => f.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Faction not found' });
  }
  
  // Validate title
  const titleValidation = helpers.validateRequiredString(req.body.title, 'Faction title');
  if (!titleValidation.valid) {
    return res.status(400).json({ success: false, message: titleValidation.message });
  }
  
  // Validate brief
  const briefValidation = helpers.validateRequiredString(req.body.brief, 'Faction brief');
  if (!briefValidation.valid) {
    return res.status(400).json({ success: false, message: briefValidation.message });
  }
  
  // Validate emblem
  const emblem = req.body.emblem;
  const emblemValidation = helpers.validateEmblem(emblem, uploadDir);
  if (!emblemValidation.valid) {
    return res.status(400).json({ success: false, message: emblemValidation.message });
  }
  
  // Validate standing
  const standingValidation = helpers.validateInteger(req.body.standing, 'Standing', 0, 4);
  if (!standingValidation.valid) {
    return res.status(400).json({ success: false, message: standingValidation.message });
  }
  
  factions[index] = {
    id: req.params.id,
    title: titleValidation.value,
    emblem: emblem,
    brief: briefValidation.value,
    standing: standingValidation.value,
    jobsCompleted: parseInt(req.body.jobsCompleted) || 0,
    jobsFailed: parseInt(req.body.jobsFailed) || 0
  };
  writeFactions(factions);
  res.json({ success: true, faction: factions[index] });
});

app.delete('/api/factions/:id', (req, res) => {
  let factions = readFactions();
  factions = factions.filter(f => f.id !== req.params.id);
  writeFactions(factions);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
