// Authentication middleware

function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.role) {
      // For API endpoints, return JSON error instead of redirect
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      return res.redirect('/?error=unauthorized');
    }
    
    if (role && req.session.role !== role) {
      // For API endpoints, return JSON error instead of redirect
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      return res.redirect('/?error=unauthorized');
    }
    
    next();
  };
}

// Middleware for any authenticated user (CLIENT or ADMIN)
const requireAnyAuth = requireAuth();

// Middleware for CLIENT routes (allows both CLIENT and ADMIN)
const requireClientAuth = (req, res, next) => {
  if (!req.session || !req.session.role) {
    // For API endpoints, return JSON error instead of redirect
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/?error=unauthorized');
  }
  
  // Allow both 'client' and 'admin' roles to access CLIENT routes
  if (req.session.role === 'client' || req.session.role === 'admin') {
    return next();
  }
  
  // For API endpoints, return JSON error instead of redirect
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return res.redirect('/?error=unauthorized');
};

// Middleware for ADMIN routes
const requireAdminAuth = requireAuth('admin');

module.exports = { requireAuth, requireAnyAuth, requireClientAuth, requireAdminAuth };
