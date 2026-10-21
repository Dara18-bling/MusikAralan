# MusikAralan

A choir-learning management system for music ministry learning and coordination.

## Stack

- React, TypeScript, Vite, and Tailwind CSS frontend
- Laravel Sanctum bearer tokens for API authentication
- Laravel JSON API for credentials, authorization, and business logic
- MySQL for accounts, classes, enrollments, learning materials, assessments, progress, announcements, chatbot replies, and system settings

The frontend does not authenticate with Firebase or access Firestore. Laravel issues 12-hour Sanctum bearer tokens after checking credentials and the account's MySQL approval status. Roles and permissions are always read from MySQL. Firebase credentials are optional and used only by the legacy Firestore import command.

## Requirements

- Node.js and npm
- PHP 8.3+ and Composer
- MySQL 8+
- Optional: a Firebase service-account credential for importing legacy Firestore data

## Run locally

1. Install frontend dependencies and configure the API URL:

   ```bash
   npm install
   copy .env.example .env
   ```

2. Prepare the backend:

   ```powershell
   cd backend
   composer install
   copy .env.example .env
   php artisan key:generate
   ```

3. Create the MySQL database named `musik_aralan`, then configure `DB_*` in `backend/.env`. Set `FRONTEND_URL` to the frontend's exact origin. The API is configured for a decoupled frontend and uses bearer tokens, so it does not rely on cross-site session cookies.

4. Seed local/testing accounts and catalog data, then start the API:

   ```bash
   php artisan migrate --seed
   php artisan storage:link
   php artisan serve
   ```

   Demo accounts are seeded only when `APP_ENV` is `local` or `testing`:

   | Role | Email | Password |
   |---|---|---|
   | Admin | `admin@musik.test` | `Password123!` |
   | Teacher | `teacher@musik.test` | `Password123!` |
   | Student | `student@musik.test` | `Password123!` |

   Do not use these credentials in a deployed environment. Production admins should be provisioned through a controlled database operation.

5. In a second terminal at the repository root, run:

   ```bash
   npm run dev
   ```

   Set `VITE_API_BASE_URL` to the deployed Laravel `/api` URL outside local development. The browser stores the Sanctum token in `sessionStorage` and sends it as a bearer token; configure CORS `FRONTEND_URL` to allow the frontend origin.

## Production notes

- Deploy the Laravel API separately from the Vercel-hosted Vite frontend, or provide an equivalent PHP hosting environment. Set MySQL, CORS, and frontend API URL values through the hosting provider's secret/environment settings. Configure a real mail transport for password reset emails.
- Use durable object storage (for example, an S3-compatible disk) for uploaded materials in production. The default `public` disk is intended for local development.
- Run Laravel migrations during deployment. Do not commit `.env` files, Firebase service-account credentials, or database credentials.
- To backfill existing Firestore data, enable the Firestore API and give the backend service account Firestore read access. Set `FIREBASE_CREDENTIALS` to that service-account JSON path; the credential is used only by the importer, not for user login. Run `php artisan musik:import-firestore` first; this performs a dry run and rolls back. Review its counts and warnings, then explicitly commit with `php artisan musik:import-firestore --commit` while writes to the old app are paused. Imported accounts retain their legacy Firebase UID for record mapping but have no Laravel password; users must use password reset before logging into the new system.

## Build and tests

```bash
npm run build
cd backend
php artisan test
```