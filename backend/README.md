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

The LMS schema keeps classes and enrollments as they are while associating classes with modules. Voice groups have many-to-many user membership. Existing built-in class assessments are the quiz implementation, and new quiz attempts are children of `module_progress`; completion currently requires passing the module's quiz and, when enabled, a completed practice session. Piano practice persistence is schema groundwork only. Materials store references/URLs, not document blobs in MySQL.

Admin announcements create Laravel database notifications for all approved users by default. Teachers can use `POST /api/classes/{class}/notifications` only for classes they handle; recipients are approved students enrolled in that class. Authenticated users can list `GET /api/notifications` and mark an item read with `PATCH /api/notifications/{id}/read`.
