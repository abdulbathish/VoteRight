const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Voter Model
 * Represents a voter in the system
 */
const Voter = sequelize.define('Voter', {
  // Primary key
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Registration ID (unique identifier from credential system)
  registration_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  
  // UIN (Unique Identification Number)
  uin: {
    type: DataTypes.STRING,
    unique: true
  },
  
  // Voter ID
  voter_id: {
    type: DataTypes.STRING,
    comment: 'Voter ID assigned to the individual'
  },
  
  // Personal Information
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  last_name: {
    type: DataTypes.STRING
  },
  
  gender: {
    type: DataTypes.STRING
  },
  
  date_of_birth: {
    type: DataTypes.DATE
  },
  
  // Address Information
  address_line1: {
    type: DataTypes.STRING
  },
  
  address_line2: {
    type: DataTypes.STRING
  },
  
  city: {
    type: DataTypes.STRING
  },
  
  postal_code: {
    type: DataTypes.STRING
  },
  
  // Email and Phone fields
  email: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    }
  },
  
  phone: {
    type: DataTypes.STRING
  },
  
  // Photo (file path or base64) / Biometrics data (JSON)
  photo: {
    type: DataTypes.TEXT, // Changed to TEXT to handle larger data
    comment: 'Stores either a path to a photo, a base64 encoded photo, or JSON biometrics data'
  },
  
  // Card Information
  issue_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  expiry_date: {
    type: DataTypes.DATE
  },
  
  // Status
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'approved', 'rejected', 'active', 'expired', 'suspended']]
    }
  },
  
  // Source of the record
  source: {
    type: DataTypes.STRING,
    defaultValue: 'manual',
    comment: 'Source of the voter record (manual, subsafe, etc.)'
  },
  
  // Timestamps
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'voters',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Voter; 