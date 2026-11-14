# MusikAralan – Music Sheet Transcription Setup Guide

This guide explains how to configure the music sheet transcription feature after cloning the MusikAralan repository.

The transcription feature uses:

- **Audiveris** – Recognizes musical notation from sheet music images.
- **Java** – Required to run Audiveris.
- **Laravel** – Handles uploads, transcription jobs, and MusicXML storage.
- **Laravel Queue** – Processes transcription in the background.
- **OpenSheetMusicDisplay (OSMD)** – Displays the recognized sheet music in the browser.
- **VexFlow** – Renders musical notation through OSMD.

## 1. System Requirements

Before setting up the project, install the following:

| Software | Purpose |
|---|---|
| PHP | Runs the Laravel backend |
| Composer | Installs PHP dependencies |
| Node.js and npm | Runs the React frontend |
| MySQL | Stores application data |
| Java | Runs Audiveris |
| Audiveris 5.11.0 | Recognizes sheet music |
| Git | Clones the repository |

Use software versions compatible with the project's `composer.json`, `package.json`, and Audiveris installation.

## 2. Clone the GitHub Repository

Open a terminal and run:

```bash
git clone https://github.com/Dara18-bling/MusikAralan.git
```

Navigate to the project:

```bash
cd MusikAralan
```

## 3. Install Frontend Dependencies

Run:

```bash
npm install
```

This installs the frontend packages, including OpenSheetMusicDisplay and its dependencies.

Check the installed OSMD version:

```bash
npm ls opensheetmusicdisplay vexflow
```

The current project uses OpenSheetMusicDisplay 2.3.0.

## 4. Install Backend Dependencies

Navigate to the backend directory:

```bash
cd backend
```

Install Laravel dependencies:

```bash
composer install
```

Create the environment configuration:

```bash
copy .env.example .env
```

Generate the Laravel application key:

```bash
php artisan key:generate
```

## 5. Install Java

Audiveris requires Java to run.

Install a Java runtime compatible with the installed Audiveris release.

Verify the installation:

```bash
java -version
```

If Java is installed correctly, the command displays its version information.

## 6. Install Audiveris

Download and install Audiveris from its official project:

https://github.com/Audiveris/audiveris

Install the version used by the project where possible (currently Audiveris 5.11.0).

After installation, verify that the executable is available.

For Windows, an example installation path is:

```text
C:\Program Files\Audiveris\Audiveris.exe
```

For Linux, the executable path will depend on the installation method.

**Important:** Each developer or deployment server must configure its own Audiveris executable path. Do not rely on the original developer's computer path.

## 7. Configure the Audiveris Environment Variable

Open the backend `.env` file.

Configure the Audiveris path using the environment variable name expected by `ProcessSheetMusic.php`.

For example, if the application reads `AUDIVERIS_PATH`, configure:

Windows:

```env
AUDIVERIS_PATH="C:\Program Files\Audiveris\Audiveris.exe"
```

Linux:

```env
AUDIVERIS_PATH="/path/to/Audiveris"
```

The variable name above is an example. Confirm the exact name used in the project's transcription job before configuring it.

After changing environment variables, clear Laravel's cached configuration:

```bash
php artisan config:clear
```

## 8. Configure the MySQL Database

Create a MySQL database for MusikAralan.

For example:

```sql
CREATE DATABASE musik_aralan;
```

Update the backend `.env` file:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=musik_aralan
DB_USERNAME=root
DB_PASSWORD=
```

Use the database username and password configured on your computer.

Run the migrations:

```bash
php artisan migrate
```

Do not use `migrate:fresh` on a database containing data because it deletes existing tables and records.

## 9. Configure Laravel File Storage

The application needs storage for uploaded sheet music images and generated MusicXML files.

In the backend directory, run:

```bash
php artisan storage:link
```

Make sure the configured filesystem disk is writable by the Laravel application.

For a local development setup, the public storage disk can be used if that is what the application is configured to use.

## 10. Start the Laravel Queue Worker

The transcription process runs in the background through Laravel queues.

Keep the queue connection configured in `.env` consistent with the project's implementation.

For example, if the project uses the database queue:

```env
QUEUE_CONNECTION=database
```

Start the worker:

```bash
php artisan queue:work
```

Keep this terminal running while testing transcription.

Without an active queue worker, uploaded sheet music may remain queued instead of being processed.

## 11. Start the Laravel Backend

Open another terminal in the backend directory:

```bash
php artisan serve
```

The backend should become available at:

```text
http://localhost:8000
```

## 12. Start the React Frontend

Open another terminal in the project root:

```bash
npm run dev
```

Use the frontend address displayed by Vite.

If the project is configured to use port 8443, the address may be:

```text
http://localhost:8443
```

Make sure the frontend API configuration and Laravel CORS settings use the correct local addresses.

## 13. Test the Music Transcription Feature

After starting the frontend, backend, and queue worker:

1. Log in to MusikAralan as a teacher.
2. Open an available class.
3. Upload a clear sheet music image.
4. Select the Sheet Music material type.
5. Wait for the transcription job to finish.
6. Open the uploaded material using a student account.
7. Check whether the recognized sheet music appears.
8. Test piano playback.
9. Check whether the notation cursor follows the playback.

The expected processing workflow is:

**Sheet Music Image → Audiveris → MusicXML → OSMD → Rendered Sheet Music**

## 14. Troubleshooting

### Transcription remains queued

Check whether the Laravel queue worker is running:

```bash
php artisan queue:work
```

### Audiveris executable not found

Check the configured executable path and the environment variable used by `ProcessSheetMusic.php`.

### Java not found

Run:

```bash
java -version
```

Install Java or correct the system PATH configuration.

### Sheet music recognition fails

Use a clear, high-resolution sheet music image.

Recommended input characteristics:

- Approximately 300 DPI when scanning.
- Clearly visible five-line musical staves.
- Straight, properly cropped pages.
- Good contrast between the notes and background.
- No excessive blur or compression.

Low-resolution images may not contain enough detail for reliable recognition. Simply enlarging an image cannot restore missing musical information.

### Sheet music does not display

Check:

- Whether the transcription job completed successfully.
- Whether a MusicXML or MXL file was generated.
- Whether the notation API returns the generated file.
- Whether OSMD reports an error while loading the MusicXML.

A successful piano playback does not necessarily mean that the MusicXML notation can be rendered successfully.

## 15. Important Deployment Notes

For production deployment:

- Install Audiveris and a compatible Java runtime on the backend server.
- Configure the executable path for the server's operating system.
- Keep queue workers running using an appropriate process manager.
- Configure persistent file storage.
- Protect uploaded files and generated MusicXML files.
- Allocate sufficient CPU and memory for transcription jobs.
- Test multiple simultaneous uploads.
- Configure backups for the database and uploaded materials.

**Note:** Audiveris must be installed on the backend environment that performs the transcription. Installing it only on a student's computer will not enable server-side transcription.

---

**End of Setup Guide**