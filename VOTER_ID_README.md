# Voter ID and UIN-Based Record Updates

This document explains the enhancements to store voter ID and update records when the same UIN is encountered with a different registration ID.

## Changes Made

### 1. Added Voter ID Field

A new `voter_id` field has been added to the database schema to store voter identification numbers:

```sql
ALTER TABLE voters 
ADD COLUMN IF NOT EXISTS voter_id VARCHAR(255);
```

The Voter model was also updated to include this field:

```javascript
voter_id: {
  type: DataTypes.STRING,
  comment: 'Voter ID assigned to the individual'
}
```

### 2. Field Mapping for Voter ID

Added field mapping in `src/config/fieldMapping.js` to extract voter ID from incoming credential data:

```javascript
{
  source: 'credentialSubject.voterId',
  target: 'voter_id',
  type: 'STRING',
  fallbackSources: ['voterId', 'credentialSubject.voterID', 'voterID', 'credentialSubject.VID', 'VID'],
}
```

This mapping looks for voter ID in multiple possible locations with different naming conventions.

### 3. UIN-Based Record Updates

The database service (`dbService.js`) was enhanced to:

1. First check if a record exists with the same registration ID
2. If not found, check if a record exists with the same UIN
3. If found by UIN, update that record with the new data

This ensures that when a new registration comes in for an existing UIN, the system updates the existing record rather than creating a duplicate.

```javascript
// Check if voter exists by registration_id
let existingVoter = await Voter.findOne({
  where: { registration_id: mappedData.registration_id }
});

// If not found, check by UIN
if (!existingVoter && mappedData.uin) {
  existingVoter = await Voter.findOne({
    where: { uin: mappedData.uin }
  });
  
  if (existingVoter) {
    console.log(`Found existing voter with UIN: ${mappedData.uin}, updating with new data from registration ID: ${mappedData.registration_id}`);
  }
}

if (existingVoter) {
  // Update existing voter
  await existingVoter.update(mappedData);
  result = existingVoter;
} else {
  // Create new voter
  result = await Voter.create(mappedData);
}
```

### 4. New Query Functions

Added new query functions to search for voters by UIN or voter ID:

```javascript
// Get voter by UIN
const getVoterByUIN = async (uin) => { ... }

// Get voter by voter ID
const getVoterByVoterId = async (voterId) => { ... }
```

## How It Works

### Storing Voter ID

When a new notification is received, the system will:
1. Extract voter ID from the credential data using the field mapping
2. Store it in the `voter_id` column in the database

### UIN-Based Updates

When a notification is received with the same UIN but a different registration ID:
1. The system detects that the UIN already exists in the database
2. Instead of creating a new record, it updates the existing record with the new data
3. The registration ID is updated to the new value
4. All other fields are updated with the new values from the notification

## Testing the Features

A test script (`test-voter-id-update.js`) is provided to verify these features:

```bash
node test-voter-id-update.js
```

The test performs the following steps:
1. Creates an initial voter record with a specific UIN and voter ID
2. Creates a second record with the same UIN but different registration ID
3. Verifies that the record was updated instead of creating a duplicate
4. Searches for the record by UIN and voter ID to confirm the changes

## Usage in Production

In a production environment, when notifications arrive through the WebSub mechanism:

1. If it's a new voter (new UIN), a new record will be created
2. If it's an existing voter (existing UIN), their record will be updated with the new data
3. The voter ID will be stored for all records

This ensures that the database maintains a single, up-to-date record for each individual, regardless of how many times their data is updated or with different registration IDs.

## Database Schema Update

The schema update script (`update-schema-voter-id.js`) can be run to add the voter_id column to an existing database:

```bash
node update-schema-voter-id.js
``` 