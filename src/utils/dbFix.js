/**
 * Database Fix Utility
 * 
 * This script fixes common database schema issues, such as:
 * 1. Modifying the voters_backup table to use VARCHAR instead of enum_voters_status
 * 2. Adding missing columns to the voters table
 */

const { sequelize } = require('../config/database');
const { logger } = require('console');

// Fix the voters_backup table that's causing enum dependency errors
const fixBackupTable = async () => {
  try {
    // Check if the backup table exists
    const backupTableExists = await sequelize.query(
      "SELECT to_regclass('public.voters_backup') as exists",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (backupTableExists[0].exists) {
      console.log('Fixing voters_backup table to remove enum dependency...');
      
      // Alter the table to change the column type from enum to varchar
      await sequelize.query(`
        ALTER TABLE voters_backup 
        ALTER COLUMN status TYPE VARCHAR(255)
      `);
      
      console.log('Successfully modified the status column in voters_backup');
    } else {
      console.log('No voters_backup table found, no fix needed.');
    }
    
    return true;
  } catch (error) {
    console.error('Error fixing backup table:', error);
    return false;
  }
};

// Ensure all required columns exist in the voters table
const ensureColumns = async () => {
  try {
    console.log('Checking for required columns in voters table...');
    
    // List of columns that should exist
    const requiredColumns = [
      { name: 'first_name', type: 'VARCHAR(255) NOT NULL' },
      { name: 'last_name', type: 'VARCHAR(255)' },
      { name: 'date_of_birth', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'address_line1', type: 'VARCHAR(255)' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'phone', type: 'VARCHAR(255)' },
      { name: 'source', type: "VARCHAR(255) DEFAULT 'manual'" },
      { name: 'status', type: "VARCHAR(255) DEFAULT 'pending'" }
    ];
    
    // Get existing columns
    const existingColumns = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'voters'",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const columnNames = existingColumns.map(col => col.column_name);
    
    // Add missing columns
    for (const column of requiredColumns) {
      if (!columnNames.includes(column.name)) {
        console.log(`Adding missing column ${column.name} to voters table...`);
        await sequelize.query(`
          ALTER TABLE voters 
          ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}
        `);
      }
    }
    
    console.log('All required columns now exist in the voters table.');
    return true;
  } catch (error) {
    console.error('Error ensuring columns exist:', error);
    return false;
  }
};

// Run both fixes
const fixDatabase = async () => {
  try {
    await fixBackupTable();
    await ensureColumns();
    console.log('Database fixes completed successfully.');
    return true;
  } catch (error) {
    console.error('Error fixing database:', error);
    return false;
  }
};

module.exports = {
  fixBackupTable,
  ensureColumns,
  fixDatabase
}; 