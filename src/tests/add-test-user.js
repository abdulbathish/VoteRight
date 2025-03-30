/**
 * Test utility to add sample users to the database
 */
require('dotenv').config();
const { testConnection } = require('../config/database');
const { syncModels } = require('../models');
const dbService = require('../services/dbService');

/**
 * Adds a test user to the database with the specified properties
 * @param {Object} userData - The user data to add
 * @returns {Promise<Object>} The saved user object
 */
async function addTestUser(userData = {}) {
  try {
    // Test connection first
    console.log('Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      throw new Error('Failed to connect to the database. Please check your configuration.');
    }
    
    // Sync models to ensure database is up to date
    await syncModels(false);
    console.log('Models synced successfully.');
    
    // Default test user data that can be overridden
    const defaultTestUser = {
      registrationId: `TEST-${Date.now()}`,
      credentialSubject: {
        UIN: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        firstName: 'Test',
        lastName: 'User',
        gender: 'Other',
        dateOfBirth: '1990-01-01',
        addressLine1: '123 Test Street',
        addressLine2: 'Apt 456',
        city: 'Test City',
        postalCode: '12345'
      },
      photo: 'path/to/test_photo.jpg',
      issueDate: new Date(),
      status: 'active'
    };
    
    // Merge default with provided data
    const testUserData = {
      ...defaultTestUser,
      ...userData,
      credentialSubject: {
        ...defaultTestUser.credentialSubject,
        ...(userData.credentialSubject || {})
      }
    };
    
    // Save the test user
    console.log('Adding test user to database...');
    const savedUser = await dbService.saveVoterData(testUserData);
    console.log('Test user added successfully!');
    console.log('User details:');
    console.log(`- Registration ID: ${savedUser.registration_id}`);
    console.log(`- UIN: ${savedUser.uin}`);
    console.log(`- Name: ${savedUser.first_name} ${savedUser.last_name}`);
    console.log(`- Status: ${savedUser.status}`);
    
    return savedUser;
  } catch (error) {
    console.error('Error adding test user:', error);
    throw error;
  }
}

// If this script is called directly, run it with default values
if (require.main === module) {
  // Admin test user
  const adminTestUser = {
    registrationId: 'ADMIN-TEST-001',
    credentialSubject: {
      UIN: '1234567890',
      firstName: 'Admin',
      lastName: 'Test User',
      gender: 'Female',
      dateOfBirth: '1990-05-15',
      addressLine1: '456 Democracy Ave',
      addressLine2: 'Suite 789',
      city: 'Democracia City',
      postalCode: '54321'
    },
    status: 'approved'
  };
  
  addTestUser(adminTestUser)
    .then(() => {
      console.log('\nYou can now view this user in the admin interface at:');
      console.log(`http://localhost:${process.env.PORT || 3000}/admin/voters`);
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { addTestUser }; 