CREOVA

CREOVA — React Native va Expo asosida ishlab chiqilayotgan mobil ilova loyihasi.

Project Information

- Project: CREOVA
- Platform: React Native
- Framework: Expo
- Expo SDK: 57
- Navigation: Expo Router
- Backend: Supabase
- Build Service: EAS Build
- Language: TypeScript

---

Features

CREOVA loyihasi quyidagi asosiy imkoniyatlarni qo‘llab-quvvatlash uchun ishlab chiqiladi:

- User registration and authentication
- User profile
- Secure session management
- Supabase database integration
- User data management
- Credit/balance system
- Payment system
- Payment transaction history
- Credit purchases
- Network status handling
- Local data storage
- Android application build
- Production deployment

---

Technology Stack

Frontend

- React Native
- Expo SDK 57
- Expo Router
- TypeScript

Backend

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage where required
- Supabase server-side functionality where required

Local Storage

- AsyncStorage

Network

- React Native NetInfo

Build

- Expo Application Services (EAS)
- Android
- iOS

---

Project Structure

The project root should contain the main configuration files:

CREOVA/
├── app/
├── assets/
├── package.json
├── package-lock.json
├── app.json
├── eas.json
├── tsconfig.json
├── README.md
└── ...

"README.md" must be located in the project root, in the same directory as "package.json".

---

Installation

Install project dependencies:

npm install

If "package-lock.json" is present and synchronized with "package.json", use:

npm ci

---

Development

Start the Expo development server:

npm start

Run Android:

npm run android

Run iOS:

npm run ios

Run Web:

npm run web

---

Code Verification

Run TypeScript verification:

npm run typecheck

Run ESLint:

npm run lint

Before starting an EAS build, the project should be checked for blocking TypeScript and lint errors.

---

Environment Variables

CREOVA uses environment variables for external services and sensitive configuration.

Expected variables may include:

EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SESSION_SECRET
SLACK_API

Additional variables may be added when required by future integrations.

Important Security Rule

Never place real secret values inside this README.md file.

The README only documents variable names.

For example, this is acceptable:

EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

This is NOT acceptable:

EXPO_PUBLIC_SUPABASE_URL=https://real-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=real-secret-value

Actual secret values must be stored securely using:

- Replit Secrets
- EAS Secrets
- Secure environment variables
- Server-side secret storage

depending on the service.

---

Supabase

CREOVA uses Supabase as its backend platform.

Supabase may be used for:

- Authentication
- PostgreSQL database
- User profiles
- User data
- Credit/balance data
- Payment records
- Transaction history
- Storage
- Server-side functions

The application connects to Supabase using environment variables.

The real Supabase credentials must never be committed to the repository.

---

Authentication

User authentication must be handled securely.

Authentication-related functionality may include:

- Registration
- Login
- Logout
- Session persistence
- Session restoration
- User profile
- Authentication state

Sensitive authentication information must not be stored directly in source code.

---

Credit System

CREOVA includes a credit/balance system.

The credit system is intended to support:

- User credit balance
- Credit packages
- Credit purchases
- Credit usage
- Credit transaction history
- Balance updates
- Transaction status

Credit Security

The mobile application must not be trusted to directly increase its own credit balance.

Credit changes should be verified and performed through secure backend logic.

The server/database must be responsible for validating credit transactions.

---

Payment System

CREOVA is intended to support a secure payment system.

The payment system may include:

- Credit package selection
- Payment creation
- Payment processing
- Payment status
- Successful payments
- Failed payments
- Cancelled payments
- Payment transaction history
- Credit allocation after successful payment

Payment Flow

A typical payment flow should be:

User
  ↓
Select Credit Package
  ↓
Create Payment
  ↓
Payment Provider
  ↓
Payment Confirmation
  ↓
Server-Side Verification
  ↓
Transaction Saved
  ↓
Credits Added
  ↓
Updated User Balance

Payment Security

Payment verification must be performed on the backend.

The mobile application must NOT:

- Confirm its own payment
- Directly increase its own balance
- Store private payment credentials
- Store payment provider secret keys
- Trust a client-side payment success message without server verification

Payment provider secret keys must be stored securely as server-side secrets.

---

Payment Provider

The final payment provider will be selected separately according to the project requirements and supported region.

The provider may be integrated later without exposing private API credentials in the mobile application.

Possible payment integrations may include a suitable local or international payment provider.

The selected provider's private keys and credentials must be stored securely.

---

Payment Database

Payment-related information should be stored securely in Supabase.

The database may contain entities such as:

Users
Credit Packages
User Balances
Payments
Transactions
Credit Transactions
Payment Statuses

The exact database schema should be implemented according to the final payment architecture.

---

Transaction Security

Financial and credit-related operations must be designed to prevent:

- Duplicate transactions
- Unauthorized balance changes
- Fake payment confirmations
- Repeated credit allocation
- Invalid transaction states
- Client-side manipulation

Payment verification should be idempotent where possible so that the same payment cannot grant credits multiple times.

---

EAS

CREOVA uses Expo Application Services for application builds.

Login:

npx eas-cli@latest login

Check Android preview configuration:

npx eas-cli@latest config -p android -e preview

---

EAS Build Profiles

The project may use the following profiles:

- development
- preview
- production

Development

Used for development builds.

Typical configuration:

developmentClient: true
distribution: internal

Preview

Used for internal testing.

Typical configuration:

distribution: internal

Production

Used for the final production application.

Production configuration must be verified before release.

---

Android Build

Preview Android build:

npx eas-cli@latest build --platform android --profile preview

Production Android build:

npx eas-cli@latest build --platform android --profile production

Before starting a build, verify:

node --version
npm --version

Then:

npm run typecheck
npm run lint

Then:

npx eas-cli@latest config -p android -e preview

Only after the configuration is valid should the build be started.

---

Build Troubleshooting

If dependencies fail to install, first inspect the error before deleting project files.

Check:

node --version
npm --version

Then:

npm ci

If the lock file is inconsistent with "package.json", use:

npm install

After dependency changes, verify:

npm run typecheck
npm run lint

Then check EAS configuration again:

npx eas-cli@latest config -p android -e preview

---

Dependency Management

"package.json" defines project dependencies and scripts.

"package-lock.json" should be kept synchronized with "package.json".

Do not manually modify files inside:

node_modules/

Do not commit "node_modules/" to the repository.

---

Git and Repository Security

Before committing changes:

git status

Review all modified and untracked files.

Do not commit secret files or credentials.

Sensitive files may include:

.env
.env.*

Never commit:

- Passwords
- API secrets
- Private API keys
- EXPO_TOKEN
- Supabase service-role keys
- Database passwords
- Payment provider secret keys
- Private credentials

---

Replit

CREOVA can be developed and configured in Replit.

Project secrets should be stored using Replit Secrets / Environment Variables.

The following names may be configured there:

EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SESSION_SECRET
SLACK_API

The actual values must remain private.

---

Production Security

Before production release:

- Verify authentication
- Verify Supabase Row Level Security
- Verify database permissions
- Verify credit transactions
- Verify payment verification
- Verify server-side authorization
- Verify environment variables
- Verify payment provider configuration
- Verify production credentials
- Remove test credentials
- Check application logs
- Test failed payments
- Test duplicate payment handling
- Test unauthorized requests

---

Testing

After a successful Android build:

1. Install the application.
2. Launch CREOVA.
3. Test registration.
4. Test login.
5. Test logout.
6. Test session restoration.
7. Test navigation.
8. Test profile functionality.
9. Test Supabase connection.
10. Test credit balance.
11. Test credit usage.
12. Test payment flow.
13. Test successful payment.
14. Test failed payment.
15. Test cancelled payment.
16. Test transaction history.
17. Test network failures.
18. Test application restart.
19. Check for crashes.

---

Production Release Checklist

Before production release:

- [ ] Application name verified
- [ ] Application icon verified
- [ ] Splash screen verified
- [ ] Android package identifier verified
- [ ] Expo configuration verified
- [ ] EAS configuration verified
- [ ] Supabase URL configured
- [ ] Supabase publishable key configured
- [ ] Authentication tested
- [ ] Database permissions verified
- [ ] Row Level Security verified
- [ ] Credit system tested
- [ ] Payment system tested
- [ ] Payment verification tested
- [ ] Transaction history tested
- [ ] Production secrets configured
- [ ] No private keys committed
- [ ] TypeScript check passed
- [ ] Lint check passed
- [ ] Android build completed
- [ ] Final application tested

---

Important Security Principle

The mobile application is a client and must not be trusted with sensitive financial operations.

The following operations must be protected by backend/server-side authorization:

- Changing user balances
- Granting credits
- Confirming payments
- Verifying payment status
- Processing financial transactions
- Accessing private credentials

The client should request these operations from secure backend functionality.

---

Project Goal

The main goal of CREOVA is to provide a stable, secure and production-ready mobile application.

The development process should prioritize:

1. Stability
2. Security
3. Correct authentication
4. Reliable Supabase integration
5. Secure credit management
6. Secure payment processing
7. Reliable Android builds
8. Production readiness

---

License

This project is private and proprietary.

---

CREOVA

CREOVA Mobile Application Project