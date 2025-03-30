# PostgreSQL Integration for Voter Card Issuer

This document provides instructions for setting up and using PostgreSQL with the Voter Card Issuer application.

## Setup Instructions

### 1. Install PostgreSQL

If you don't already have PostgreSQL installed, you can download it from:
https://www.postgresql.org/download/

For macOS users, you can use Homebrew:
```bash
brew install postgresql
```

For Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
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

### 3. Configure Environment Variables

The following environment variables should be set in your `.env` file:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=voter_database
```

Update these values according to your PostgreSQL configuration.

## Database Schema

The application uses Sequelize ORM and automatically creates the following tables:

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

## Field Mapping

The application uses a field mapping configuration to map incoming data to database columns. This is defined in `src/config/fieldMapping.js`.

Each mapping contains:
- `source`: The path to the field in the incoming data (using dot notation)
- `target`: The column name in the database
- `type`: The data type for the field
- `transform`: (Optional) A function to transform the data before storing
- `fallbackSources`: (Optional) Alternative sources to check if primary source is not found

## API Endpoints

The application provides the following endpoints for voter data management:

### Admin Routes

- `GET /admin/voters` - List all voters (paginated)
- `GET /admin/voters/:id` - View voter details for a specific registration ID

## Development

To force recreate all tables (WARNING: this will delete all data):

```javascript
// In index.js
await syncModels(true);
```

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

### Logging

Database logs can be viewed by setting the NODE_ENV to 'development' in your .env file:

```
NODE_ENV=development
``` 