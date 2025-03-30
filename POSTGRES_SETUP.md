# PostgreSQL Integration Guide

This guide provides detailed instructions for setting up and using PostgreSQL with the Voter Card Issuer application.

## Setup Instructions

### 1. Install PostgreSQL

If you don't already have PostgreSQL installed, you can download it from:
https://www.postgresql.org/download/

For macOS users, you can use Homebrew:
```bash
brew install postgresql@14
brew services start postgresql@14
```

For Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database

Create a database for the application:

```bash
# Login to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE voter_database;

# Exit psql
\q
```

If you're using macOS with Homebrew, you might not need a password:
```bash
createdb voter_database
```

### 3. Configure Environment Variables

Update the following environment variables in your `.env` file:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
DB_NAME=voter_database
```

### 4. Install Required Dependencies

The application uses Sequelize ORM to interact with PostgreSQL. Make sure you have the required dependencies:

```bash
npm install pg sequelize
```

## Testing the Database Connection

You can test the database connection by running:

```bash
node test-db.js
```

This script will:
1. Connect to the database
2. Create tables if they don't exist
3. Insert a test record 
4. Retrieve the record
5. Delete the test record

## Adding Test Data

To add some test data to see in the admin interface:

```bash
node add-test-user.js
```

This will add a sample voter with the following details:
- Registration ID: ADMIN-TEST-001
- Name: Admin Test User

## Simulating Notifications

To test the data mapping and storage functionality, you can simulate a notification:

```bash
node simulate-notification.js
```

This script simulates data that would normally come from the SubSafe WebSub notification handler.

## Database Structure

The application automatically creates the required tables:

### Voters Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (auto-increment) |
| registration_id | STRING | Unique registration ID (from credential system) |
| uin | STRING | Unique Identification Number |
| first_name | STRING | First name |
| last_name | STRING | Last name |
| gender | STRING | Gender |
| date_of_birth | DATE | Date of birth |
| address_line1 | STRING | Address line 1 |
| address_line2 | STRING | Address line 2 |
| city | STRING | City |
| postal_code | STRING | Postal code |
| photo | STRING | Path to photo or base64 encoded string |
| issue_date | DATE | Date when voter ID was issued |
| expiry_date | DATE | Expiry date for voter ID |
| status | ENUM | Status (pending, active, expired, suspended) |
| created_at | DATE | Record creation timestamp |
| updated_at | DATE | Record last update timestamp |

## Field Mapping System

The application uses a field mapping system to extract data from various structures and map them to database fields. This is defined in `src/config/fieldMapping.js`.

Each mapping contains:
- `source`: The path to the field in the incoming data (using dot notation)
- `target`: The column name in the database
- `type`: The data type for the field
- `transform`: (Optional) A function to transform the data before storing
- `fallbackSources`: (Optional) Alternative sources to check if primary source is not found

### Example Mapping

```javascript
{
  source: 'credentialSubject.firstName',
  target: 'first_name',
  type: 'STRING',
  fallbackSources: ['firstName', 'name'],
  transform: (value) => {
    if (Array.isArray(value)) {
      return value[0]?.value || '';
    }
    return value || '';
  }
}
```

## Adding Custom Field Mappings

To add custom field mappings, edit the `src/config/fieldMapping.js` file and add your mapping to the appropriate model mapping array.

For example, to add a new field to the voter model:

```javascript
{
  source: 'credentialSubject.newField',
  target: 'new_field_column',
  type: 'STRING',
  fallbackSources: ['newField', 'alt_new_field'],
}
```

You would also need to add the corresponding column to the model in `src/models/voter.js`:

```javascript
new_field_column: {
  type: DataTypes.STRING
},
```

## Admin Interface

The application provides an admin interface to view and manage voter data:

- `http://localhost:3006/admin/voters` - List all voters (paginated)
- `http://localhost:3006/admin/voters/:id` - View details for a specific voter

## Troubleshooting

### Connection Issues

If you encounter database connection issues:

1. Verify PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Check that the environment variables are correctly set

3. Ensure the database exists:
   ```bash
   psql -U postgres -l
   ```

4. Try connecting manually:
   ```bash
   psql -U postgres -d voter_database
   ```

### Database Reset

To reset the database and recreate all tables (WARNING: this will delete all data):

1. Edit the `syncModels` call in `index.js` to use `force: true`:
   ```javascript
   await syncModels(true);
   ```

2. Alternatively, drop and recreate the database:
   ```bash
   dropdb voter_database
   createdb voter_database
   ``` 