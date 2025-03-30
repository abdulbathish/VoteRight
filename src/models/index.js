const { sequelize } = require('../config/database');
const Voter = require('./voter');

// Import other models as needed
// const OtherModel = require('./otherModel');

// Define model relationships here if needed
// For example:
// Voter.hasMany(OtherModel);
// OtherModel.belongsTo(Voter);

// Function to sync all models with the database
const syncModels = async (force = false) => {
  try {
    if (force) {
      console.log('WARNING: Force sync requested, but this can cause enum dependency issues. Setting force to false.');
      force = false;
    }
    
    // Always use alter: true instead of force: true to avoid dropping tables
    // This is safer for production data
    await sequelize.sync({ alter: true, force: false });
    console.log('Database models synchronized successfully');
    return true;
  } catch (error) {
    console.error('Failed to synchronize database models:', error);
    
    // If we get a dependency error with enum types, log a more helpful message
    if (error.name === 'SequelizeDatabaseError' && error.original && error.original.code === '2BP01') {
      console.error(`
        Enum dependency error detected. This usually happens when there are backup tables 
        or other tables that depend on enum types that Sequelize is trying to drop.
        
        To fix this, you may need to manually modify the database schema or drop the backup tables.
        For example: DROP TABLE IF EXISTS voters_backup CASCADE;
      `);
    }
    
    return false;
  }
};

module.exports = {
  sequelize,
  Voter,
  // Export other models here
  // OtherModel,
  syncModels
}; 