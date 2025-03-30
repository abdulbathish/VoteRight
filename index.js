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

// Import database models and services
const { testConnection, sequelize } = require('./src/config/database');
const { syncModels } = require('./src/models');
const dbService = require('./src/services/dbService');
const { fixDatabase } = require('./src/utils/dbFix');

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

// Path middleware - Add currentPath to all templates
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

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
subsafe.onNotification(async (data, rawEvent) => {
  logger.info('Event received - DataShare Mode');
  
  if (data && data.error) {
    logger.error('Error in decryption:', { error: data.error });
    return;
  }
  
  logger.info('Message successfully received and decrypted');
  
  // Process and store voter information in database
  try {
    // Check if registrationId exists in the data
    if (!data.registrationId) {
      // Try to extract registration ID from other available fields
      if (data.credentialSubject && data.credentialSubject.UIN) {
        data.registrationId = data.credentialSubject.UIN;
      } else if (data.UIN) {
        data.registrationId = data.UIN;
      } else if (data.id) {
        data.registrationId = data.id;
      } else if (data.credentialSubject && data.credentialSubject.id) {
        data.registrationId = data.credentialSubject.id;
      } else {
        // Generate a unique ID as a last resort
        data.registrationId = `RID-${uuidv4()}`;
        logger.info(`Generated registration ID: ${data.registrationId} as none was found in the data`);
      }
    }
    
    // Add source information
    data.source = 'subsafe_notification';
    
    // Add empty values for required fields if they don't exist to prevent database errors
    if (!data.email) data.email = null;
    if (!data.phone) data.phone = null;
    
    // Log data structure for debugging
    logger.debug('Processing data with mapping:', {
      registrationId: data.registrationId,
      hasCredentialSubject: !!data.credentialSubject,
      source: data.source
    });
    
    // Save voter data to database using the mapping configuration
    const savedVoter = await dbService.saveVoterData(data);
    logger.info('Voter data saved to database:', { 
      registration_id: savedVoter.registration_id,
      name: `${savedVoter.first_name || ''} ${savedVoter.last_name || ''}`.trim(),
      source: savedVoter.source
    });
  } catch (error) {
    logger.error('Error saving voter data from SubSafe notification:', error.message);
    
    // Log detailed error information
    if (error.name === 'SequelizeDatabaseError') {
      logger.error('Database error details:', { 
        message: error.message,
        sql: error.sql?.substring(0, 100) + '...',
        code: error.parent?.code
      });
    }
    
    // Log the data structure to help with debugging
    logger.debug('Data structure that caused the error:', {
      data_keys: Object.keys(data),
      registration_id: data.registrationId,
      has_credential_subject: !!data.credentialSubject
    });
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

app.post('/apply', upload.single('photo'), validateAge, async (req, res) => {
  try {
    // Extract all form fields
    console.log('Full request body:', req.body);
    const { firstName, lastName, dob, gender, addressLine1, addressLine2, city, postalCode, phone, email } = req.body;
    const photoPath = req.file ? req.file.path : null;
    
    // Generate unique voter ID and registration ID
    const voterId = `VID-${uuidv4().substring(0, 8).toUpperCase()}`;
    const registrationId = `MAN-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    
    // Log the received form data for debugging
    logger.debug('Manual application form data received:', { 
      firstName, lastName, dob, gender, addressLine1, addressLine2, city, postalCode, phone, email, photoPath 
    });
    
    // Create voter record - keep all field names in both formats to ensure compatibility
    const voter = {
      // Basic info
      registrationId: registrationId,
      registration_id: registrationId,
      
      // Name
      firstName: firstName,
      first_name: firstName,
      lastName: lastName,
      last_name: lastName,
      
      // Identity
      gender: gender,
      dob: dob,
      date_of_birth: dob,
      
      // Address
      addressLine1: addressLine1,
      address_line1: addressLine1,
      addressLine2: addressLine2 || null,
      address_line2: addressLine2 || null,
      city: city,
      postalCode: postalCode,
      postal_code: postalCode,
      
      // Contact
      email: email || null,
      phone: phone || null,
      
      // Photo
      photo: photoPath,
      photoPath: photoPath,
      
      // Status
      status: 'pending',
      source: 'manual_application',
      
      // Timestamps
      created_at: new Date(),
      updated_at: new Date(),
      
      // Hash for duplicate detection
      hash: CryptoJS.SHA256(`${firstName}${lastName}${dob}`).toString(),
      
      // Voter ID
      voter_id: voterId,
      voterId: voterId
    };
    
    // Save to database
    logger.info('Saving voter data from manual application', { 
      registration_id: registrationId,
      first_name: firstName,
      last_name: lastName
    });
    
    const savedVoter = await dbService.saveVoterData(voter);
    
    // Redirect to confirmation page
    res.render('confirmation', { 
      voter: savedVoter, 
      title: 'Application Submitted - Democracia' 
    });
  } catch (error) {
    logger.error('Error saving voter data from manual application:', error.message);
    res.render('apply', { 
      error: 'There was an error processing your application. Please try again.',
      title: 'Apply for Voter ID - Democracia'
    });
  }
});

app.get('/status', (req, res) => {
  res.render('status', { title: 'Check Application Status - Democracia' });
});

app.post('/status', async (req, res) => {
  const { rid, email } = req.body;
  
  try {
    // Find voter by RID only, not using email/phone to avoid database errors
    let whereClause = {
      registration_id: rid
    };
    
    // Email/phone filtering will be done in memory instead of database
    const voter = await sequelize.models.Voter.findOne({ 
      where: whereClause
    });
    
    if (voter) {
      // Check if the email/phone matches (if voter has these fields)
      const matchesEmail = !email || 
                          (voter.email && email.includes('@') && voter.email === email) || 
                          (voter.phone && !email.includes('@') && voter.phone === email);
      
      if (matchesEmail) {
        res.render('status-result', { voter, title: 'Application Status - Democracia' });
      } else {
        res.render('status', { 
          error: 'No matching record found. Please check your RID and email/phone and try again.',
          rid: rid,
          email: email,
          title: 'Check Application Status - Democracia' 
        });
      }
    } else {
      res.render('status', { 
        error: 'No matching record found. Please check your RID and email/phone and try again.',
        rid: rid,
        email: email,
        title: 'Check Application Status - Democracia' 
      });
    }
  } catch (error) {
    logger.error('Error retrieving voter status:', error.message);
    res.render('status', { 
      error: 'Error retrieving application status. Please try again later.',
      title: 'Check Application Status - Democracia' 
    });
  }
});

// Admin routes
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { title: 'Admin Login - Democracia Electoral Commission' });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple admin authentication (use proper auth in production)
  if (username === (process.env.ADMIN_USERNAME || 'admin') && 
      password === (process.env.ADMIN_PASSWORD || 'admin123')) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { error: 'Invalid credentials', title: 'Admin Login - Democracia Electoral Commission' });
  }
});

app.get('/admin/dashboard', isAdminLoggedIn, async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1; // Current page (default: 1)
    const limit = parseInt(req.query.limit) || 10; // Records per page (default: 10)
    const offset = (page - 1) * limit;
    
    // Get voters with pagination
    const voters = await dbService.getAllVoters({ limit, offset });
    const count = await sequelize.models.Voter.count();
    
    // Get counts for different statuses
    const approvedCount = await sequelize.models.Voter.count({ where: { status: 'approved' } });
    const pendingCount = await sequelize.models.Voter.count({ where: { status: 'pending' } });  
    const rejectedCount = await sequelize.models.Voter.count({ where: { status: 'rejected' } });
    
    res.render('admin/dashboard', { 
      voters, 
      totalVoters: count,
      totalApproved: approvedCount,
      totalPending: pendingCount,
      totalRejected: rejectedCount,
      filteredCount: voters.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        hasNext: page < Math.ceil(count / limit),
        hasPrev: page > 1
      },
      title: 'Admin Dashboard - Democracia Electoral Commission' 
    });
  } catch (error) {
    console.error('Error fetching voters for dashboard:', error);
    res.status(500).render('error', { 
      message: 'Failed to retrieve voter list',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' } 
    });
  }
});

// Individual voter details page
app.get('/admin/voter/:id', isAdminLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const voter = await dbService.getVoterByRegistrationId(id);
    
    if (!voter) {
      return res.status(404).render('error', { 
        message: 'Voter not found', 
        title: 'Error - Democracia Electoral Commission'
      });
    }
    
    res.render('admin/voter-detail', { 
      voter, 
      title: `Voter Details: ${voter.first_name} ${voter.last_name} - Democracia Electoral Commission` 
    });
  } catch (error) {
    console.error('Error fetching voter details:', error);
    res.status(500).render('error', { 
      message: 'Failed to retrieve voter details',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' } 
    });
  }
});

app.post('/admin/approve/:id', isAdminLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the voter
    const voter = await dbService.getVoterByRegistrationId(id);
    
    if (voter) {
      // Update status to approved
      await sequelize.models.Voter.update(
        { 
          status: 'approved',
          updated_at: new Date()
        },
        { where: { registration_id: id } }
      );
    }
    
    // Check if a redirect URL is specified
    const returnTo = req.query.returnTo || '/admin/dashboard';
    res.redirect(returnTo);
  } catch (error) {
    console.error('Error approving voter:', error);
    res.status(500).render('error', { 
      message: 'Failed to approve voter',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' } 
    });
  }
});

app.post('/admin/reject/:id', isAdminLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the voter
    const voter = await dbService.getVoterByRegistrationId(id);
    
    if (voter) {
      // Update status to rejected
      await sequelize.models.Voter.update(
        { 
          status: 'rejected',
          updated_at: new Date()
        },
        { where: { registration_id: id } }
      );
    }
    
    // Check if a redirect URL is specified
    const returnTo = req.query.returnTo || '/admin/dashboard';
    res.redirect(returnTo);
  } catch (error) {
    console.error('Error rejecting voter:', error);
    res.status(500).render('error', { 
      message: 'Failed to reject voter',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' } 
    });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// API for voter card generation
app.get('/api/voter-card/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const voter = await dbService.getVoterByRegistrationId(id);
    
    if (!voter) {
      return res.status(404).json({ error: 'Voter not found' });
    }
    
    if (voter.status !== 'approved') {
      return res.status(403).json({ error: 'Voter ID not approved yet' });
    }
    
    // Return voter card data
    res.json({
      id: voter.registration_id,
      name: `${voter.first_name} ${voter.last_name}`,
      dob: voter.date_of_birth,
      issueDate: voter.issue_date,
      expiryDate: voter.expiry_date,
      voter_id: voter.voter_id
    });
  } catch (error) {
    console.error('Error generating voter card data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to view voter ID card
app.get('/voter-card/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const voter = await dbService.getVoterByRegistrationId(id);
    
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
      expiryDate: voter.expiry_date
    });
  } catch (error) {
    console.error('Error displaying voter card:', error);
    res.status(500).render('error', { 
      message: 'Failed to retrieve voter card',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' } 
    });
  }
});

// Handle base voter-card route without ID
app.get('/voter-card', (req, res) => {
  res.status(400).render('error', { 
    message: 'Voter ID not provided in the URL',
    title: 'Error - Democracia Voter ID System'
  });
});

// Admin - Voter List (redirecting to dashboard for consistency)
app.get('/admin/voters', isAdminLoggedIn, (req, res) => {
  res.redirect('/admin/dashboard');
});

// Admin - View Voter
app.get('/admin/voters/:id', isAdminLoggedIn, async (req, res) => {
  try {
    const voter = await dbService.getVoterByRegistrationId(req.params.id);
    
    if (!voter) {
      return res.status(404).render('error', { 
        message: 'Voter not found',
        error: { status: 404, stack: '' } 
      });
    }
    
    res.render('admin/voter-detail', { 
      voter,
      title: `Voter Details: ${voter.first_name} ${voter.last_name} - Democracia Electoral Commission`
    });
  } catch (error) {
    logger.error('Error fetching voter details:', error);
    res.status(500).render('error', { 
      message: 'Failed to retrieve voter details',
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' } 
    });
  }
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
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('Database connection failed. Exiting application.');
      process.exit(1);
    }
    
    // Run database fix utility to address schema issues
    logger.info('Running database schema fixes...');
    await fixDatabase();
    
    // Sync database models without force to preserve existing data
    logger.info('Synchronizing database models with force=false');
    await syncModels(false); // Set to false to avoid dropping tables
    
    // Add missing columns directly using SQL
    try {
      logger.info('Checking if the voters table exists...');
      const tableExists = await sequelize.query(
        "SELECT to_regclass('public.voters') as exists",
        { type: sequelize.QueryTypes.SELECT }
      );
      
      if (!tableExists[0].exists) {
        logger.error('Voters table does not exist in the database, creating it now...');
        // Create the table with the basic structure
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS voters (
            id SERIAL PRIMARY KEY,
            registration_id VARCHAR(255) NOT NULL UNIQUE,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255),
            date_of_birth DATE,
            uin VARCHAR(255),
            voter_id VARCHAR(255),
            gender VARCHAR(255),
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(255),
            postal_code VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(255),
            photo TEXT,
            source VARCHAR(255) DEFAULT 'manual',
            status VARCHAR(50) DEFAULT 'pending',
            issue_date TIMESTAMP,
            expiry_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        logger.info('Voters table created successfully');
      } else {
        // Check and add missing columns
        logger.info('Checking for missing columns and adding them...');
        const columns = ['email', 'phone', 'source'];
        
        for (const column of columns) {
          try {
            // Check if column exists
            const columnExists = await sequelize.query(
              `SELECT column_name FROM information_schema.columns 
               WHERE table_name = 'voters' AND column_name = '${column}'`,
              { type: sequelize.QueryTypes.SELECT }
            );
            
            if (columnExists.length === 0) {
              // Add the missing column
              logger.info(`Adding missing column: ${column}`);
              let dataType = column === 'source' ? 'VARCHAR(255) DEFAULT \'manual\'' : 'VARCHAR(255)';
              await sequelize.query(`ALTER TABLE voters ADD COLUMN IF NOT EXISTS ${column} ${dataType};`);
            }
          } catch (columnError) {
            logger.error(`Error checking/adding column ${column}:`, columnError.message);
          }
        }
      }
    } catch (schemaUpdateError) {
      logger.error('Error updating database schema:', schemaUpdateError.message);
    }
    
    // Start the Express server for the web application
    expressServer = app.listen(PORT, () => {
      logger.info(`Voter ID Card Issuer app listening on port ${PORT}`);
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
    process.exit(1);
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
    // Close database connection
    await sequelize.close();
    logger.info('Database connection closed');
    
    // Unsubscribe from WebSub
    await subsafe.unsubscribe();
    logger.info('Unsubscribed from WebSub topic');
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