/**
 * Field Mapping Configuration
 * 
 * This file defines how fields from incoming data should be mapped to database columns.
 * Each mapping contains:
 * - source: The path to the field in the incoming data (using dot notation)
 * - target: The column name in the database
 * - type: The data type for the field
 * - transform: (Optional) A function to transform the data before storing
 */

const fieldMappings = {
  // Voter model mappings
  voter: [
    {
      source: 'registrationId',
      target: 'registration_id',
      type: 'STRING',
      required: true,
    },
    {
      source: 'source',
      target: 'source',
      type: 'STRING',
      defaultValue: 'manual'
    },
    {
      source: 'credentialSubject.UIN',
      target: 'uin',
      type: 'STRING',
      fallbackSources: ['credentialSubject.id', 'UIN', 'id'],
    },
    {
      source: 'voter_id',
      target: 'voter_id',
      type: 'STRING',
      fallbackSources: ['voterId', 'credentialSubject.voterId', 'credentialSubject.voterID', 'voterID', 'credentialSubject.VID', 'VID'],
    },
    {
      source: 'first_name',
      target: 'first_name',
      type: 'STRING',
      fallbackSources: ['firstName', 'credentialSubject.firstName', 'name'],
      transform: (value) => {
        // Handle array format or direct string value
        if (Array.isArray(value)) {
          return value[0]?.value || '';
        }
        return value || '';
      }
    },
    {
      source: 'last_name',
      target: 'last_name',
      type: 'STRING',
      fallbackSources: ['lastName', 'credentialSubject.lastName'],
      transform: (value) => {
        if (Array.isArray(value)) {
          return value[0]?.value || '';
        }
        return value || '';
      }
    },
    {
      source: 'gender',
      target: 'gender',
      type: 'STRING',
      fallbackSources: ['credentialSubject.gender'],
      transform: (value) => {
        if (Array.isArray(value)) {
          return value[0]?.value || '';
        }
        return value || '';
      }
    },
    {
      source: 'date_of_birth',
      target: 'date_of_birth',
      type: 'DATE',
      fallbackSources: ['dob', 'credentialSubject.dateOfBirth', 'credentialSubject.dob', 'dateOfBirth'],
      transform: (value) => {
        if (!value) return null;
        // Handle different date formats
        try {
          // If it's already a Date object, return it
          if (value instanceof Date) return value;
          
          // Try to parse the date
          return new Date(value);
        } catch (e) {
          console.error('Error parsing date:', e);
          return null;
        }
      }
    },
    {
      source: 'address_line1',
      target: 'address_line1',
      type: 'STRING',
      fallbackSources: ['addressLine1', 'credentialSubject.addressLine1'],
      transform: (value) => {
        if (Array.isArray(value)) {
          return value[0]?.value || '';
        }
        return value || '';
      }
    },
    {
      source: 'address_line2',
      target: 'address_line2',
      type: 'STRING',
      fallbackSources: ['addressLine2', 'credentialSubject.addressLine2'],
      transform: (value) => {
        if (Array.isArray(value)) {
          return value[0]?.value || '';
        }
        return value || '';
      }
    },
    {
      source: 'city',
      target: 'city',
      type: 'STRING',
      fallbackSources: ['credentialSubject.city'],
      transform: (value) => {
        if (Array.isArray(value)) {
          return value[0]?.value || '';
        }
        return value || '';
      }
    },
    {
      source: 'postal_code',
      target: 'postal_code',
      type: 'STRING',
      fallbackSources: ['postalCode', 'credentialSubject.postalCode', 'zipCode'],
    },
    {
      source: 'photo',
      target: 'photo',
      type: 'STRING',
      fallbackSources: ['credentialSubject.biometrics', 'biometrics', 'face.biometrics'],
      transform: (value, sourceData) => {
        // Simple case - already have a file path
        if (typeof value === 'string' && (value.includes('/') || value.includes('\\'))) {
          return value;
        }
        
        // Try to extract biometrics data
        if (value) {
          if (typeof value === 'string') {
            return value;
          } else if (typeof value === 'object') {
            // If it's an object, stringify it
            return JSON.stringify(value);
          }
        }
        
        // Fallback logic to check other possible sources
        const possibleSources = [
          sourceData.biometrics,
          sourceData.credentialSubject?.biometrics,
          sourceData.credentialSubject?.face?.biometrics,
          sourceData.photo,
          sourceData.credentialSubject?.photo
        ];
        
        for (const source of possibleSources) {
          if (source) {
            if (typeof source === 'string') {
              return source;
            } else if (typeof source === 'object') {
              return JSON.stringify(source);
            }
          }
        }
        
        return null;
      }
    },
    {
      source: 'issueDate',
      target: 'issue_date',
      type: 'DATE',
      defaultValue: () => new Date(),
    },
    {
      source: 'expiryDate',
      target: 'expiry_date',
      type: 'DATE',
      transform: () => {
        const today = new Date();
        const validity = parseInt(process.env.VOTER_ID_VALIDITY_YEARS || 10, 10);
        today.setFullYear(today.getFullYear() + validity);
        return today;
      },
    },
    {
      source: 'email',
      target: 'email',
      type: 'STRING',
      fallbackSources: ['credentialSubject.email', 'credentialSubject.emailId', 'emailId'],
    },
    {
      source: 'phone',
      target: 'phone',
      type: 'STRING',
      fallbackSources: ['credentialSubject.phone', 'credentialSubject.phoneNumber', 'phoneNumber'],
    },
    {
      source: 'status',
      target: 'status',
      type: 'STRING',
      defaultValue: 'pending',
    }
  ]
};

module.exports = fieldMappings; 