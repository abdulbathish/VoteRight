# Democracia Voter ID System

A web application for issuing voter ID cards for the fictitious country of Democracia. This application allows citizens to apply for a voter ID, check their application status, and for administrators to review and approve applications. It also integrates with WebSub for receiving and processing voter registration data from external systems.

## Features

- **User Features**
  - Apply for a new voter ID card with photo upload
  - Check application status using registration ID, date of birth, and contact information
  - View and download approved voter ID cards
  
- **Admin Features**
  - Secure admin login portal
  - Dashboard with application statistics
  - Review, approve, or reject voter ID applications
  - View applicant details and photos

- **Integration Features**
  - WebSub subscription for receiving voter registration data
  - Decryption of secure data using SubSafe package
  - Automatic processing of voter data for citizens 18+ years old
  - Lightweight digital voter ID cards

## Technologies Used

- Node.js with Express.js
- EJS templating engine
- Bootstrap 5 for responsive design
- UUID for unique ID generation
- Multer for file uploads
- CryptoJS for secure hashing
- SubSafe for WebSub subscription and data decryption

## Installation and Setup

1. Clone the repository
```
git clone https://github.com/yourusername/votercard-issuer.git
cd votercard-issuer
```

2. Install dependencies
```
npm install
```

3. Create a `.env` file with the following variables:
```
# Server Configuration
PORT=3000
NODE_ENV=development
SUBSAFE_PORT=3001

# Session Configuration
SESSION_SECRET=your-secret-key

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Application Settings
COUNTRY_NAME=Democracia
VOTER_ID_VALIDITY_YEARS=10

# Logging Configuration
LOG_LEVEL=info

# Data Source Configuration
DATA_SOURCE_MODE=datashare
DIRECT_MESSAGE_PATH=event.data.credential

# MOSIP Authentication Configuration
MOSIP_BASE_URL=https://api-internal.democracia.gov
MOSIP_CLIENT_ID=voter-default-print
MOSIP_SECRET_KEY=electoral-commission-secret
MOSIP_TOKEN_URL=https://auth.democracia.gov/auth/realms/democracia/protocol/openid-connect/token
MOSIP_AUTH_ENDPOINT=/v1/authmanager/authenticate/clientidsecretkey
MOSIP_APP_ID=voter-system

# WebSub Configuration
MOSIP_WEBSUB_URL=https://api-internal.democracia.gov/hub
MOSIP_TOPIC=voter-default-print/CREDENTIAL_ISSUED
MOSIP_WEBSUB_SECRET=electoral-commission-websub-secret
CALLBACK_URL=https://voter-id.democracia.gov/callback/notifyEvent
CALLBACK_PATH=/callback/notifyEvent

# Data Share Configuration
DATASHARE_BASE_URL=https://api-internal.democracia.gov

# Decryption Configuration
P12_PATH=./certs/voter-id-system.p12
P12_PASSWORD=credential-secret-key
TEMP_ENCRYPTED_FILE=./logs/temp-encrypted.txt
TEMP_DECRYPTED_FILE=./logs/temp-decrypted.txt

# Auto Subscription
AUTO_SUBSCRIBE=true
```

4. Create directories for logs and certificates:
```
mkdir -p logs certs
```

5. Start the application
```
npm start
```

For development with auto-restart:
```
npm run dev
```

6. Access the application at `http://localhost:3000`

## Application Structure

- `/views` - EJS templates for the UI
- `/public` - Static assets (CSS, JS, images)
- `/uploads` - Uploaded applicant photos
- `/logs` - Application logs and temporary files
- `/certs` - Certificate files for decryption
- `index.js` - Main application file

## WebSub Integration

The application uses WebSub to receive voter registration data from external systems:

1. The application subscribes to a topic at the specified hub URL
2. When new voter data is published, the hub sends a notification to the callback URL
3. The application receives the notification and decrypts the data
4. If the person is 18+ years old, a voter record is created or updated in the database
5. The user can then check their status using their registration ID, DOB, and contact info

## Admin Access

- URL: `/admin/login`
- Default credentials:
  - Username: admin
  - Password: admin123

## License

This project is licensed under the ISC License.

## Note

This is a fictitious project for demonstration purposes only. The Democracia country and its electoral system are imaginary. 