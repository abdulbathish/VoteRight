/**
 * System Configuration
 * 
 * This file defines system-wide configuration settings.
 * These settings can be overridden using environment variables.
 */

// Parse unique identifier field from environment variable
const parseUniqueIdentifierField = () => {
  const envValue = process.env.UNIQUE_IDENTIFIER_FIELD;
  
  if (!envValue) {
    return 'uin'; // Default value if not specified
  }
  
  // Check if it's a comma-separated list
  if (envValue.includes(',')) {
    // Split by comma and trim each value
    return envValue.split(',').map(field => field.trim());
  }
  
  // Single value
  return envValue.trim();
};

// Default configuration values
const systemConfig = {
  // Unique field configuration
  // This determines which field(s) will be used to detect existing records
  // Options: 'uin', 'voter_id', 'registration_id', or an array of these values
  // If an array is provided, it will check each field in order until it finds a match
  uniqueIdentifierField: parseUniqueIdentifierField(),
  
  // Database configuration
  database: {
    maxPoolConnections: parseInt(process.env.DB_MAX_POOL_CONNECTIONS || '5', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10)
  },
  
  // Card validity in years
  voterIdValidityYears: parseInt(process.env.VOTER_ID_VALIDITY_YEARS || '10', 10),
  
  // Update behavior
  // If true, when a match is found by uniqueIdentifierField, all fields will be updated
  // If false, only changed fields will be updated
  updateAllFields: process.env.UPDATE_ALL_FIELDS === 'true' || false,
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    includeTimestamp: process.env.LOG_INCLUDE_TIMESTAMP !== 'false'
  }
};

// Function to get the unique identifier field as an array
const getUniqueIdentifierFields = () => {
  if (Array.isArray(systemConfig.uniqueIdentifierField)) {
    return systemConfig.uniqueIdentifierField;
  }
  return [systemConfig.uniqueIdentifierField];
};

module.exports = {
  systemConfig,
  getUniqueIdentifierFields
}; 