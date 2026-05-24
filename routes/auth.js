const express = require('express');
const dataStore = require('../models/dataStore');

const router = express.Router();

router.get('/', (req, res) => {
  const settings = dataStore.readSettings();
  res.render('landing', { error: req.query.error, colorScheme: settings.colorScheme, settings });
});

router.post('/authenticate', (req, res) => {
  const password = req.body.password;
  const settings = dataStore.readSettings();
  
  // Check against passwords from settings
  if (password === settings.clientPassword) {
    req.session.role = 'client';
    res.redirect('/client/overview');
  } else if (password === settings.adminPassword) {
    req.session.role = 'admin';
    res.redirect('/admin');
  } else {
    res.redirect('/?error=invalid');
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
