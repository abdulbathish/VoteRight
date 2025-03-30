/**
 * Database Service
 * Handles database operations using the field mapping configuration
 */

const { Voter } = require('../models');
const fieldMappings = require('../config/fieldMapping');
const { mapData } = require('../utils/dataMapper');
const { systemConfig, getUniqueIdentifierFields } = require('../config/systemConfig');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Find existing voter based on the configured unique identifier fields
 * @param {Object} mappedData - The mapped voter data
 * @returns {Promise<Object>} - The existing voter record or null if not found
 */
const findExistingVoter = async (mappedData) => {
  // Get the configured unique identifier fields in order of priority
  const uniqueFields = getUniqueIdentifierFields();
  
  let existingVoter = null;
  
  // Try to find a match for each configured unique field
  for (const field of uniqueFields) {
    if (mappedData[field]) {
      const dbField = field; // Convert to database field name if needed
      
      try {
        const voter = await Voter.findOne({
          where: { [dbField]: mappedData[field] }
        });
        
        if (voter) {
          console.log(`Found existing voter with ${field}: ${mappedData[field]}, updating with new data from registration ID: ${mappedData.registration_id}`);
          existingVoter = voter;
          break; // Found a match, stop searching
        }
      } catch (error) {
        console.error(`Error searching for voter by ${field}:`, error);
        // Continue to the next field
      }
    }
  }
  
  return existingVoter;
};

/**
 * Persist voter data to the database
 * @param {Object} data - The voter data to be saved
 * @returns {Promise<Object>} - The saved voter data
 */
const saveVoterData = async (data) => {
  try {
    console.log('Raw data received for saving:', JSON.stringify(data, null, 2));
    
    // Do direct mapping for manual applications instead of using field mappings
    let directData = {};
    
    if (data.source === 'manual_application') {
      // Handle manual application form data directly
      directData = {
        registration_id: data.registrationId,
        voter_id: data.voter_id || data.voterId,
        first_name: data.firstName || data.first_name,
        last_name: data.lastName || data.last_name,
        gender: data.gender,
        date_of_birth: data.dob ? new Date(data.dob) : (data.date_of_birth ? new Date(data.date_of_birth) : null),
        address_line1: data.addressLine1 || data.address_line1 || data.address,
        address_line2: data.addressLine2 || data.address_line2,
        city: data.city,
        postal_code: data.postalCode || data.postal_code,
        email: data.email,
        phone: data.phone,
        photo: data.photo || data.photoPath,
        status: data.status || 'pending',
        source: data.source,
        issue_date: new Date(),
        expiry_date: (() => {
          const today = new Date();
          const validity = parseInt(process.env.VOTER_ID_VALIDITY_YEARS || 10, 10);
          today.setFullYear(today.getFullYear() + validity);
          return today;
        })(),
        created_at: data.created_at || new Date(),
        updated_at: new Date()
      };
      
      console.log('Manual form data directly mapped:', JSON.stringify(directData, null, 2));
    } else {
      // Use field mappings for API/MOSIP data
      directData = mapData(data, fieldMappings.voter);
      console.log('Mapped data after transformation:', JSON.stringify(directData, null, 2));
    }
    
    // Check if the voters table exists
    try {
      const tableExists = await sequelize.query(
        "SELECT to_regclass('public.voters') as exists",
        { type: sequelize.QueryTypes.SELECT }
      );
      
      if (!tableExists[0].exists) {
        console.error('Voters table does not exist in the database. Creating table...');
        
        // Create the voters table with basic structure
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
        console.log('Voters table created successfully');
      }
    } catch (tableCheckError) {
      console.error('Error checking/creating voters table:', tableCheckError);
    }
    
    // Check if we're trying to use columns that don't exist in the database yet
    // Remove fields that might cause SQL errors (email, phone, source)
    const fieldsToCheck = ['email', 'phone', 'source'];
    const safeData = { ...directData };
    
    try {
      // Try to get the table columns
      const tableInfo = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'voters'",
        { type: sequelize.QueryTypes.SELECT }
      );
      
      // Get column names from the result
      const existingColumns = tableInfo.map(col => col.column_name);
      
      // Filter out non-existent columns
      fieldsToCheck.forEach(field => {
        if (!existingColumns.includes(field)) {
          console.warn(`Column '${field}' does not exist in the database. Removing from data.`);
          delete safeData[field];
        }
      });
    } catch (err) {
      console.error('Error checking table columns:', err.message);
      // Fallback - remove potentially problematic fields
      fieldsToCheck.forEach(field => delete safeData[field]);
    }
    
    console.log('Final data to save:', JSON.stringify(safeData, null, 2));
    
    let result;
    
    // First check if voter already exists by registration_id for backward compatibility
    let existingVoter = await Voter.findOne({
      where: { registration_id: safeData.registration_id }
    });
    
    // If not found by registration_id, check by configured unique identifier fields
    if (!existingVoter) {
      existingVoter = await findExistingVoter(safeData);
    }
    
    if (existingVoter) {
      // Update existing voter
      await existingVoter.update(safeData);
      result = existingVoter;
      console.log(`Updated voter with registration ID: ${safeData.registration_id}`);
    } else {
      // Create new voter
      result = await Voter.create(safeData);
      console.log(`Created new voter with registration ID: ${safeData.registration_id}`);
    }
    
    // Restore the mapped fields that we removed for database operations
    // This ensures the returned object has all fields, even if they weren't saved
    fieldsToCheck.forEach(field => {
      if (field in directData && !(field in result)) {
        result[field] = directData[field];
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error saving voter data:', error);
    
    // If table doesn't exist, return a mock result with the data we have
    if (error.name === 'SequelizeDatabaseError' && error.parent?.code === '42P01') {
      console.error('Voters table does not exist. Returning unsaved data.');
      return {
        ...directData,
        id: null,
        created_at: new Date(),
        updated_at: new Date(),
        _unsaved: true
      };
    }
    
    throw error;
  }
};

/**
 * Get voter by registration ID
 * @param {string} registrationId - The registration ID
 * @returns {Promise<Object>} - The voter data
 */
const getVoterByRegistrationId = async (registrationId) => {
  try {
    return await Voter.findOne({
      where: { registration_id: registrationId }
    });
  } catch (error) {
    console.error(`Error fetching voter with registration ID ${registrationId}:`, error);
    throw error;
  }
};

/**
 * Get voter by UIN
 * @param {string} uin - The UIN
 * @returns {Promise<Object>} - The voter data
 */
const getVoterByUIN = async (uin) => {
  try {
    return await Voter.findOne({
      where: { uin: uin }
    });
  } catch (error) {
    console.error(`Error fetching voter with UIN ${uin}:`, error);
    throw error;
  }
};

/**
 * Get voter by voter ID
 * @param {string} voterId - The voter ID
 * @returns {Promise<Object>} - The voter data
 */
const getVoterByVoterId = async (voterId) => {
  try {
    return await Voter.findOne({
      where: { voter_id: voterId }
    });
  } catch (error) {
    console.error(`Error fetching voter with voter ID ${voterId}:`, error);
    throw error;
  }
};

/**
 * Get all voters
 * @param {Object} options - Query options (limit, offset, etc.)
 * @returns {Promise<Array>} - Array of voter data
 */
const getAllVoters = async (options = {}) => {
  try {
    const { limit = 10, offset = 0, ...otherOptions } = options;
    
    return await Voter.findAll({
      limit,
      offset,
      ...otherOptions,
      order: [['created_at', 'DESC']]
    });
  } catch (error) {
    console.error('Error fetching all voters:', error);
    throw error;
  }
};

/**
 * Delete voter by registration ID
 * @param {string} registrationId - The registration ID
 * @returns {Promise<boolean>} - True if deleted successfully
 */
const deleteVoterByRegistrationId = async (registrationId) => {
  try {
    const deletedCount = await Voter.destroy({
      where: { registration_id: registrationId }
    });
    
    return deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting voter with registration ID ${registrationId}:`, error);
    throw error;
  }
};

module.exports = {
  saveVoterData,
  getVoterByRegistrationId,
  getVoterByUIN,
  getVoterByVoterId,
  getAllVoters,
  deleteVoterByRegistrationId
}; 