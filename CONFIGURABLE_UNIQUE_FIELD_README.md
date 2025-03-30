# Configurable Unique Identifier Fields

This document explains the implementation of configurable unique identifier fields in the Voter Card Issuer system, allowing administrators to choose which field (UIN, voter ID, registration ID, etc.) should be used to detect duplicate records.

## Overview

The system now supports configurable unique identifier fields, which means:

1. You can configure which field(s) should be used to check for existing records
2. When a record with the same unique identifier is found, it will be updated rather than creating a duplicate
3. Multiple unique identifier fields can be specified in order of priority
4. The configuration can be changed via environment variables or directly in the code

## Configuration

### Setting the Unique Identifier Field

The unique identifier field can be set in two ways:

#### 1. Using Environment Variables

Add the `UNIQUE_IDENTIFIER_FIELD` environment variable:

```bash
# Set UIN as the unique identifier (default)
UNIQUE_IDENTIFIER_FIELD=uin

# Or use voter_id instead
UNIQUE_IDENTIFIER_FIELD=voter_id

# Or use registration_id
UNIQUE_IDENTIFIER_FIELD=registration_id

# For multiple fields, use comma-separated values
UNIQUE_IDENTIFIER_FIELD=uin,voter_id,registration_id
```

#### 2. Directly in the System Configuration

Modify the `systemConfig.js` file:

```javascript
// Single field configuration
systemConfig.uniqueIdentifierField = 'uin';

// Or multiple fields in order of priority
systemConfig.uniqueIdentifierField = ['uin', 'voter_id', 'registration_id'];
```

### Available Unique Identifier Fields

The following fields can be used as unique identifiers:

- `uin` - Unique Identification Number
- `voter_id` - Voter ID assigned to the individual
- `registration_id` - Registration ID for the credential

## How It Works

### Single Field Configuration

When a single field is configured (e.g., `uin`):

1. When a new record is received, the system first checks if a record exists with the same registration ID (for backward compatibility)
2. If not found, it checks if any record exists with the same value in the configured unique field (e.g., same UIN)
3. If a match is found, the existing record is updated with the new data
4. If no match is found, a new record is created

### Multiple Fields Configuration

When multiple fields are configured (e.g., `['uin', 'voter_id', 'registration_id']`):

1. The system checks each field in the order specified
2. As soon as a match is found on any field, that record is updated
3. The search stops at the first match
4. If no matches are found on any field, a new record is created

## Implementation Details

### System Configuration

The unique identifier field setting is managed in `src/config/systemConfig.js`:

```javascript
const systemConfig = {
  // Unique field configuration
  uniqueIdentifierField: process.env.UNIQUE_IDENTIFIER_FIELD || 'uin',
  
  // Other configuration settings...
};
```

### Database Service

The database service uses this configuration to determine how to look up existing records:

```javascript
// Find existing voter based on the configured unique identifier fields
const findExistingVoter = async (mappedData) => {
  // Get the configured unique identifier fields in order of priority
  const uniqueFields = getUniqueIdentifierFields();
  
  // Try to find a match for each configured unique field
  for (const field of uniqueFields) {
    if (mappedData[field]) {
      const voter = await Voter.findOne({
        where: { [field]: mappedData[field] }
      });
      
      if (voter) {
        // Found a match
        return voter;
      }
    }
  }
  
  return null;
};
```

## Testing the Feature

A test script is provided to verify the functionality:

```bash
node test-configurable-unique-field.js
```

This script:

1. Tests updating records using UIN as the unique identifier
2. Changes the configuration to use voter_id and tests updates
3. Changes the configuration to use registration_id and tests updates
4. Tests using multiple unique identifier fields in sequence

## Use Cases

### Use Case 1: UIN as Unique Identifier

Most common use case, where UIN is the primary identifier for an individual. When the same UIN is encountered with a different registration ID, the system updates the existing record.

### Use Case 2: Voter ID as Unique Identifier

In some cases, the voter ID might be the primary identifier. When the same voter ID is encountered, even with a different UIN or registration ID, the system updates the existing record.

### Use Case 3: Registration ID as Unique Identifier

If registration ID needs to be used as the unique identifier (for example, when UIN might change but registration ID is stable), this configuration ensures that records with the same registration ID are updated.

### Use Case 4: Multiple Identifiers in Order of Priority

For maximum flexibility, multiple identifier fields can be specified in order of priority. This allows the system to first check UIN, then voter ID, then registration ID, updating the first matching record it finds.

## Best Practices

1. **Choose the Right Identifier**: Select the identifier that is most stable and unique for your use case.
2. **Order Matters**: When using multiple fields, arrange them in order of priority.
3. **Environment Variables**: Use environment variables for easy configuration in different environments.
4. **Monitor Updates**: Log when records are updated based on unique identifier matches to track system behavior.

## Conclusion

The configurable unique identifier field feature provides flexibility in how the system identifies and updates existing records, allowing administrators to choose the field(s) that best suit their requirements. 