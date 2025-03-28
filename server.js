import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
const { Database } = sqlite3.verbose();
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development' || false;

// Setup database
const dbPath = path.join(__dirname, 'scores.db');
const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    
    // Create scores table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      score INTEGER NOT NULL,
      wave INTEGER NOT NULL,
      victory BOOLEAN NOT NULL,
      datetime TEXT NOT NULL,
      duration INTEGER NOT NULL,
      ip_address TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating scores table:', err.message);
      }
    });
  }
});

// Middleware with security enhancements
// Set up CORS with more specific options
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Ideally replace with specific domains in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// JSON body parsing with limits to prevent abuse
app.use(express.json({ 
  limit: '10kb',  // Limit body size
  strict: true    // Only accept arrays and objects
}));

// Security headers
app.use((req, res, next) => {
  // Set custom development mode header only if in development
  if (IS_DEVELOPMENT) {
    res.setHeader('X-Development-Mode', 'true');
  }
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com");
  
  // Remove server fingerprinting
  res.removeHeader('X-Powered-By');
  
  next();
});

// Rate limiting basic implementation
const requestCounts = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // Maximum requests per window

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  // Initialize or clean up old request counts
  if (!requestCounts[ip] || now - requestCounts[ip].windowStart > RATE_LIMIT_WINDOW) {
    requestCounts[ip] = {
      windowStart: now,
      count: 1
    };
  } else {
    requestCounts[ip].count++;
    // Check if rate limit exceeded
    if (requestCounts[ip].count > RATE_LIMIT_MAX) {
      return res.status(429).json({ 
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil((requestCounts[ip].windowStart + RATE_LIMIT_WINDOW - now) / 1000)
      });
    }
  }
  
  next();
});

// Serve static files
app.use(express.static('./dist'));

// API endpoint to save score
app.post('/api/scores', (req, res) => {
  const { username, score, wave, victory, duration, gameData } = req.body;
  
  // Enhanced validation
  if (!username || score === undefined || wave === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Data validation and sanitization
  const sanitizedUsername = username.toString().substring(0, 30).replace(/[^\w\s]/gi, ''); // Alphanumeric only, max 30 chars
  const sanitizedScore = parseInt(score, 10);
  const sanitizedWave = parseInt(wave, 10);
  const sanitizedVictory = Boolean(victory);
  const sanitizedDuration = parseInt(duration || 0, 10);
  
  // Additional numeric bounds validation
  if (isNaN(sanitizedScore) || sanitizedScore < 0 || sanitizedScore > 1000000) {
    return res.status(400).json({ error: 'Invalid score value' });
  }
  
  if (isNaN(sanitizedWave) || sanitizedWave < 0 || sanitizedWave > 100) {
    return res.status(400).json({ error: 'Invalid wave value' });
  }
  
  if (isNaN(sanitizedDuration) || sanitizedDuration < 0 || sanitizedDuration > 86400) { // Max 24 hours
    return res.status(400).json({ error: 'Invalid duration value' });
  }
  
  // Get client IP (for optional tracking and rate limiting)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Store score in database with prepared statement and sanitized values
  const query = `INSERT INTO scores (username, score, wave, victory, datetime, duration, ip_address) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(query, [
    sanitizedUsername, 
    sanitizedScore, 
    sanitizedWave, 
    sanitizedVictory ? 1 : 0, 
    new Date().toISOString(),
    sanitizedDuration,
    ip
  ], function(err) {
    if (err) {
      console.error('Error saving score:', err.message);
      return res.status(500).json({ error: 'Failed to save score' });
    }
    
    // Return success response with the inserted ID (not exposing internal DB details)
    res.status(201).json({ 
      success: true, 
      message: 'Score saved successfully'
    });
  });
});

// API endpoint to get high scores
app.get('/api/scores', (req, res) => {
  // Sanitize and validate the limit parameter
  let limit = parseInt(req.query.limit, 10) || 20;
  
  // Apply reasonable bounds
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100; // Cap at 100 records max
  
  // Use prepared statement for security
  db.all(`SELECT username, score, wave, victory, datetime, duration 
          FROM scores 
          ORDER BY score DESC 
          LIMIT ?`, [limit], (err, rows) => {
    if (err) {
      console.error('Error fetching scores:', err.message);
      return res.status(500).json({ error: 'Failed to fetch scores' });
    }
    
    // Add cache control headers for better performance
    res.set('Cache-Control', 'public, max-age=60'); // Cache for 60 seconds
    
    // Return sanitized data
    const sanitizedRows = rows.map(row => ({
      username: row.username,
      score: row.score,
      wave: row.wave,
      victory: Boolean(row.victory),
      datetime: row.datetime,
      duration: row.duration || 0
    }));
    
    res.json(sanitizedRows);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    errorId: Date.now() // For tracking in logs
  });
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Close database connection when server shuts down
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    }
    process.exit(0);
  });
});