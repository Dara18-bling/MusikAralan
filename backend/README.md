# MusikAralan API

This directory contains the Laravel JSON API and MySQL schema for MusikAralan. Application setup, Sanctum bearer authentication, demo credentials, optional legacy Firestore import, and deployment instructions are in the repository [README](../README.md).

For local development:

```bash
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

The API uses 12-hour Sanctum bearer tokens for authentication. Configure MySQL connection variables and `FRONTEND_URL` in `.env`. Set `FIREBASE_CREDENTIALS` only if importing legacy Firestore data.
