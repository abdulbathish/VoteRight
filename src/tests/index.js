/**
 * Main test runner for the Voter ID Card application
 * Provides a centralized way to run various test utilities
 */
require('dotenv').config();
const { addTestUser } = require('./add-test-user');
const { testConnection } = require('../config/database');
const { syncModels } = require('../models');
const dbService = require('../services/dbService');

/**
 * Main test runner function
 * @param {string} testType - Type of test to run
 * @param {Object} options - Test options
 */
async function runTest(testType, options = {}) {
  try {
    // Test database connection first
    console.log('Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      throw new Error('Failed to connect to the database. Please check configuration.');
    }
    
    console.log('Database connection successful.');
    
    // Sync models
    console.log('Syncing models...');
    await syncModels(false);
    console.log('Models synced successfully.');
    
    // Run the specified test
    switch (testType.toLowerCase()) {
      case 'add-user':
        return await addTestUser(options.userData || {});
        
      case 'list-users':
        const users = await dbService.getAllVoters(options);
        console.log(`Found ${users.length} voters in the database.`);
        users.forEach(user => {
          console.log(`- ${user.first_name} ${user.last_name} (ID: ${user.registration_id})`);
        });
        return users;
        
      case 'delete-user':
        if (!options.registrationId) {
          throw new Error('Registration ID is required to delete a user');
        }
        const deleted = await dbService.deleteVoterByRegistrationId(options.registrationId);
        console.log(`User with registration ID ${options.registrationId} ${deleted ? 'deleted' : 'not found'}.`);
        return deleted;
        
      default:
        console.log('Available test types:');
        console.log('  - add-user: Add a test user to the database');
        console.log('  - list-users: List all users in the database');
        console.log('  - delete-user: Delete a user by registration ID');
        return null;
    }
  } catch (error) {
    console.error(`Error running test '${testType}':`, error);
    throw error;
  }
}

// If this script is called directly, handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0] || 'help';
  
  // Parse additional options from command line
  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const optionName = args[i].substring(2);
      const optionValue = args[i+1] && !args[i+1].startsWith('--') ? args[i+1] : true;
      options[optionName] = optionValue;
      if (optionValue !== true) i++; // Skip the value
    }
  }
  
  runTest(testType, options)
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { runTest }; 