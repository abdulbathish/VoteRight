/**
 * Voter ID Card Issuer - Main Application
 * A web application for issuing voter ID cards for a fictitious country
 */

// Load environment variables
require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const expressLayouts = require('express-ejs-layouts');
const SubSafe = require('subsafe');
const logger = console;

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set datashare mode explicitly
process.env.DATA_SOURCE_MODE = 'datashare';
logger.info('Using DATA_SOURCE_MODE=datashare');

// Configure session
app.use(session({
  secret: process.env.SESSION_SECRET || 'votercard-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Configure body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage });

// Make sure we have temp files for encrypted and decrypted content
const tempEncryptedFile = process.env.TEMP_ENCRYPTED_FILE || path.resolve(__dirname, './logs/temp-encrypted.txt');
const tempDecryptedFile = process.env.TEMP_DECRYPTED_FILE || path.resolve(__dirname, './logs/temp-decrypted.txt');

// Ensure directories exist
fs.mkdirSync(path.dirname(tempEncryptedFile), { recursive: true });
fs.mkdirSync(path.dirname(tempDecryptedFile), { recursive: true });

// Create empty files if they don't exist
if (!fs.existsSync(tempEncryptedFile)) {
  logger.info(`Creating empty file: ${tempEncryptedFile}`);
  fs.writeFileSync(tempEncryptedFile, '');
}

if (!fs.existsSync(tempDecryptedFile)) {
  logger.info(`Creating empty file: ${tempDecryptedFile}`);
  fs.writeFileSync(tempDecryptedFile, '');
}

// In-memory database for voter data (in a real app, use a proper database)
const voterDatabase = [];

// Initialize SubSafe for WebSub subscription and decryption with DST-DEV configuration
const subsafe = new SubSafe({
  // Server configuration 
  port: process.env.SUBSAFE_PORT || 3001,
  
  // Log level configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // WebSub configuration
  hubUrl: process.env.MOSIP_WEBSUB_URL,
  topic: process.env.MOSIP_TOPIC,
  callbackPath: process.env.CALLBACK_PATH || '/callback/notifyEvent',
  secret: process.env.MOSIP_WEBSUB_SECRET,
  
  // Data source configuration - explicitly set to datashare mode
  dataSourceMode: 'datashare',
  
  // Auth configuration
  baseUrl: process.env.MOSIP_BASE_URL,
  clientId: process.env.MOSIP_CLIENT_ID,
  clientSecret: process.env.MOSIP_SECRET_KEY,
  tokenUrl: process.env.MOSIP_TOKEN_URL,
  authEndpoint: process.env.MOSIP_AUTH_ENDPOINT,
  appId: process.env.MOSIP_APP_ID,
  
  // Data share configuration
  dataShareBaseUrl: process.env.DATASHARE_BASE_URL,
  
  // Decryption configuration
  p12Path: process.env.P12_PATH,
  p12Password: process.env.P12_PASSWORD,
  tempEncryptedFile: tempEncryptedFile,
  tempDecryptedFile: tempDecryptedFile
});

// Register notification handler for incoming messages
subsafe.onNotification((data, rawEvent) => {
  logger.info('Event received - DataShare Mode');
  
  if (data && data.error) {
    logger.error('Error in decryption:', { error: data.error });
    return;
  }
  
  logger.info('Message successfully received and decrypted');
  logger.info('Decrypted data:', data);
  
  // Extract voter information from the data
  try {
    // Check if data has registrationId (either directly or in credentialSubject)
    const registrationId = data.registrationId || 
                         (data.credentialSubject && data.credentialSubject.UIN) || 
                         (data.credentialSubject && data.credentialSubject.id);
    
    if (registrationId) {
      logger.info(`Processing registration ID: ${registrationId}`);
      
      // Extract credentialSubject if it exists
      const subject = data.credentialSubject || data;
      
      // Get name fields - handling both array and direct string values
      let firstName = '';
      if (subject.firstName) {
        firstName = Array.isArray(subject.firstName) ? 
                   (subject.firstName[0] && subject.firstName[0].value ? subject.firstName[0].value : '') : 
                   subject.firstName;
      }
      
      let lastName = '';
      if (subject.lastName) {
        lastName = Array.isArray(subject.lastName) ? 
                  (subject.lastName[0] && subject.lastName[0].value ? subject.lastName[0].value : '') : 
                  subject.lastName;
      }
      
      // Get address fields - handling both array and direct string values
      let address = '';
      if (subject.addressLine1) {
        const addressLine1 = Array.isArray(subject.addressLine1) ? 
                           (subject.addressLine1[0] && subject.addressLine1[0].value ? subject.addressLine1[0].value : '') : 
                           subject.addressLine1;
        
        const addressLine2 = subject.addressLine2 ? 
                           (Array.isArray(subject.addressLine2) ? 
                            (subject.addressLine2[0] && subject.addressLine2[0].value ? subject.addressLine2[0].value : '') : 
                            subject.addressLine2) : 
                           '';
        
        const city = subject.city ? 
                    (Array.isArray(subject.city) ? 
                     (subject.city[0] && subject.city[0].value ? subject.city[0].value : '') : 
                     subject.city) : 
                    '';
        
        address = [addressLine1, addressLine2, city, subject.postalCode].filter(Boolean).join(', ');
      }
      
      // Get date of birth and calculate age
      const dob = subject.dob || subject.dateOfBirth;
      if (!dob) {
        logger.info(`Skipping registration ID ${registrationId} - No date of birth found`);
        return;
      }
      
      const dobDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

      // Check if person meets the minimum age requirement
      const minAge = parseInt(process.env.MIN_VOTER_AGE) || 18;
      if (minAge > 0 && age < minAge) {
        logger.info(`Skipping registration ID ${registrationId} - Person is under minimum age of ${minAge} (${age} years old)`);
        return;
      }

      // Create voter record with received data
      const voter = {
        id: `VID-${uuidv4().substring(0, 8).toUpperCase()}`,
        firstName: firstName,
        lastName: lastName,
        dob: dob,
        address: address,
        idNumber: subject.idNumber || subject.UIN || '',
        registrationId: registrationId,
        phone: subject.phone || subject.phoneNumber || '',
        email: subject.email || '',
        photoPath: subject.photoPath || null,
        status: 'pending',
        createdAt: new Date(),
        hash: CryptoJS.SHA256(`${registrationId}${dob}`).toString(),
        rawData: data // Store the complete data for reference
      };
      
      // Save to database
      const existingIndex = voterDatabase.findIndex(v => v.id === voter.id);
      if (existingIndex >= 0) {
        logger.info(`Updating existing record for registration ID: ${registrationId}`);
        voterDatabase[existingIndex] = voter;
      } else {
        logger.info(`Adding new record for registration ID: ${registrationId}`);
        voterDatabase.push(voter);
      }
    }
  } catch (error) {
    logger.error('Error processing notification data:', error);
  }
});

// Middleware to check if admin is logged in
const isAdminLoggedIn = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// Age validation middleware
const validateAge = (req, res, next) => {
  const { dob } = req.body;
  
  // Calculate age
  const dobDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const monthDiff = today.getMonth() - dobDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
    age--;
  }
  
  // Check if person meets the minimum age requirement
  const minAge = parseInt(process.env.MIN_VOTER_AGE) || 18;
  if (minAge > 0 && age < minAge) {
    return res.render('apply', { 
      error: `You must be at least ${minAge} years old to apply for a voter ID card.`,
      title: 'Apply for Voter ID - Democracia'
    });
  }
  
  next();
};

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Home - Democracia Voter ID System' });
});

app.get('/apply', (req, res) => {
  res.render('apply', { title: 'Apply for Voter ID - Democracia' });
});

app.post('/apply', upload.single('photo'), validateAge, (req, res) => {
  const { firstName, lastName, dob, address, idNumber, phone, email } = req.body;
  const photoPath = req.file ? req.file.path : null;
  
  // Generate unique voter ID
  const voterId = `VID-${uuidv4().substring(0, 8).toUpperCase()}`;
  
  // Create voter record
  const voter = {
    id: voterId,
    firstName,
    lastName,
    dob,
    address,
    idNumber,
    registrationId: idNumber, // Store RID separately for searching
    phone,
    email,
    photoPath,
    status: 'pending',
    createdAt: new Date(),
    hash: CryptoJS.SHA256(`${firstName}${lastName}${dob}${idNumber}`).toString()
  };
  
  // Save to database
  voterDatabase.push(voter);
  
  // Redirect to confirmation page
  res.render('confirmation', { voter, title: 'Application Submitted - Democracia' });
});

app.get('/status', (req, res) => {
  res.render('status', { title: 'Check Application Status - Democracia' });
});

app.post('/status', (req, res) => {
  const { rid, email } = req.body;
  
  // Find voter by RID and email only
  const voter = voterDatabase.find(v => 
    (v.idNumber === rid || v.registrationId === rid) && 
    v.email === email
  );
  
  if (voter) {
    res.render('status-result', { voter, title: 'Application Status - Democracia' });
  } else {
    res.render('status', { 
      error: 'No matching record found. Please check your RID and email and try again.',
      rid: rid,
      email: email,
      title: 'Check Application Status - Democracia' 
    });
  }
});

// Admin routes
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { title: 'Admin Login - Democracia Electoral Commission' });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple admin authentication (use proper auth in production)
  if (username === (process.env.ADMIN_USERNAME || 'admin') && 
      password === (process.env.ADMIN_PASSWORD || 'admin123')) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin-login', { error: 'Invalid credentials', title: 'Admin Login - Democracia Electoral Commission' });
  }
});

app.get('/admin/dashboard', isAdminLoggedIn, (req, res) => {
  res.render('admin-dashboard', { voters: voterDatabase, title: 'Admin Dashboard - Democracia Electoral Commission' });
});

app.post('/admin/approve/:id', isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const voterIndex = voterDatabase.findIndex(v => v.id === id);
  
  if (voterIndex !== -1) {
    voterDatabase[voterIndex].status = 'approved';
    voterDatabase[voterIndex].approvedAt = new Date();
  }
  
  res.redirect('/admin/dashboard');
});

app.post('/admin/reject/:id', isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const voterIndex = voterDatabase.findIndex(v => v.id === id);
  
  if (voterIndex !== -1) {
    voterDatabase[voterIndex].status = 'rejected';
    voterDatabase[voterIndex].rejectedAt = new Date();
  }
  
  res.redirect('/admin/dashboard');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// API for voter card generation
app.get('/api/voter-card/:id', (req, res) => {
  const { id } = req.params;
  const voter = voterDatabase.find(v => v.id === id);
  
  if (!voter) {
    return res.status(404).json({ error: 'Voter not found' });
  }
  
  if (voter.status !== 'approved') {
    return res.status(403).json({ error: 'Voter ID not approved yet' });
  }
  
  // Return voter card data (in a real app, generate a PDF or card image)
  res.json({
    id: voter.id,
    name: `${voter.firstName} ${voter.lastName}`,
    dob: voter.dob,
    issueDate: voter.approvedAt,
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
    hash: voter.hash
  });
});

// Route to view voter ID card
app.get('/voter-card/:id', (req, res) => {
  const { id } = req.params;
  const voter = voterDatabase.find(v => v.id === id);
  
  if (!voter) {
    return res.status(404).render('error', { 
      message: 'Voter ID not found',
      title: 'Error - Democracia Voter ID System'
    });
  }
  
  if (voter.status !== 'approved') {
    return res.status(403).render('error', { 
      message: 'Voter ID not approved yet',
      title: 'Error - Democracia Voter ID System'
    });
  }
  
  res.render('voter-card', { 
    voter,
    title: 'Voter ID Card - Democracia Electoral Commission',
    expiryDate: new Date(new Date(voter.approvedAt).setFullYear(new Date(voter.approvedAt).getFullYear() + 10))
  });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Extract callback URL from environment
const callbackUrl = process.env.CALLBACK_URL;
logger.info(`Using callback URL: ${callbackUrl}`);

// Start servers
let expressServer;

// Start main application and WebSub subscriber
const startApp = async () => {
  try {
    // Start the Express server for the web application
    expressServer = app.listen(PORT, () => {
      logger.info(`Voter ID Card Issuer running on http://localhost:${PORT}`);
    });

    // Start SubSafe server for WebSub subscription
    await subsafe.start(callbackUrl);
    logger.info('Server started successfully');
    logger.info(`Using callback URL: ${subsafe.callbackUrl}`);
    
    // Subscribe to topic
    if (process.env.AUTO_SUBSCRIBE === 'true') {
      try {
        logger.info('Subscribing to topic...');
        await subsafe.subscribe();
        logger.info('Subscription successful');
        logger.info('Waiting for notifications with dataShareUri... Press Ctrl+C to exit');
      } catch (error) {
        logger.error('Error during subscription:', error);
      }
    }
  } catch (error) {
    logger.error('Server start error:', error);
  }
};

// Graceful shutdown handler
const shutdown = async () => {
  logger.info('Shutting down servers...');
  
  if (expressServer) {
    expressServer.close(() => {
      logger.info('Express server closed');
    });
  }
  
  try {
    await subsafe.stop();
    logger.info('SubSafe server stopped');
  } catch (error) {
    logger.error('Error stopping SubSafe server:', error);
  }
  
  // Force exit after a short timeout to ensure all connections are closed
  setTimeout(() => {
    logger.info('Forcing process exit');
    process.exit(0);
  }, 1000);
};

// Handle termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the application
startApp(); 