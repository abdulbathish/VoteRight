# Date of Birth and Biometrics Integration

This document explains the modifications made to properly store date of birth and biometrics data in the PostgreSQL database.

## Changes Made

### 1. Updated Field Mappings

The field mapping configuration in `src/config/fieldMapping.js` was updated with the following changes:

1. **Date of Birth Mapping**:
   - Changed primary source from `credentialSubject.dob` to `credentialSubject.dateOfBirth`
   - Added additional fallback sources including `credentialSubject.dob`
   - Added transformation function to properly handle various date formats

2. **Biometrics Data Mapping**:
   - Changed primary source from `photo` to `credentialSubject.biometrics`
   - Added comprehensive fallback sources to check different locations
   - Added transformation function to handle object-to-string conversion for JSON data

### 2. Database Schema Update

The `photo` column in the `voters` table was modified from `VARCHAR(255)` to `TEXT` to accommodate larger biometrics data:

```sql
ALTER TABLE voters 
ALTER COLUMN photo TYPE TEXT;
```

This change was necessary because biometrics data in JSON format can exceed the 255 character limit of the default VARCHAR type.

## How It Works

### Date of Birth Handling

The system now properly handles date of birth in the following formats:
- Direct date string (e.g., "1985-07-21")
- Date objects
- Various locations in the credential data structure

The transformation function ensures the date is stored in a consistent format in the database.

### Biometrics Data Storage

Biometrics data is now stored in the `photo` field as JSON string, which can include:
- Face biometrics
- Fingerprint data
- Iris scans
- Any other biometric information provided

The transformation function handles conversion from object format to string format for storage.

## Testing the Changes

Two test scripts are provided to verify these changes:

1. **Basic Test**: `test-dob-biometrics.js`
   ```bash
   node test-dob-biometrics.js
   ```
   This performs a basic test with sample data to ensure date of birth and biometrics are correctly mapped and stored.

2. **Real-world Simulation**: `simulate-real-data.js`
   ```bash
   node simulate-real-data.js
   ```
   This simulates a more realistic credential data structure similar to what would be received in a real notification.

## Viewing Stored Data

You can view the stored data using SQL queries:

```sql
-- View all records with date of birth
SELECT id, registration_id, first_name, last_name, date_of_birth 
FROM voters;

-- View biometrics data samples
SELECT registration_id, left(photo, 50) as photo_sample 
FROM voters 
WHERE photo IS NOT NULL;
```

Or through the admin interface at:
```
http://localhost:3006/admin/voters
```

## Configuration

If additional changes are needed to the field mapping, edit the following:

1. For mapping changes: `src/config/fieldMapping.js`
2. For model changes: `src/models/voter.js`

## Troubleshooting

If you encounter issues with data not being stored correctly:

1. Check the database schema to ensure the `photo` column is of type `TEXT`:
   ```sql
   \d voters
   ```

2. Verify the field mapping configuration for the source paths.

3. Test with the `simulate-real-data.js` script which provides detailed information about the mapping process. 