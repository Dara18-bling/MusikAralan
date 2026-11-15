# API Polling Intervals

This document records the polling cadence before and after the interval
consolidation. `watchApi` makes an immediate request when subscribed, then
repeats at its configured interval. Calls to `refreshApi` can trigger an
additional request between polls.

## Interval definitions

| Former interval | Former actual cadence | Current cadence |
| --- | --- | --- |
| `POLL_INTERVAL_TWO_MINUTES` | 60 minutes (`60 * 60 * 1000`) | 60 minutes (`POLL_INTERVAL_HOUR`) |
| `POLL_INTERVAL_TEN_MINUTES` | 60 minutes (`60 * 60 * 1000`) | 60 minutes (`POLL_INTERVAL_HOUR`) |
| Explicit `60_000` polling timers | 60 seconds | 60 minutes (`POLL_INTERVAL_HOUR`) |
| `POLL_INTERVAL_DAY` or `watchApi` default | 24 hours | 24 hours |

The former `TWO_MINUTES` and `TEN_MINUTES` names did not match their values;
their callers were already polling hourly. The three explicit 60-second API
polls were increased to hourly.

## API endpoint inventory

| Endpoint | Polling call sites | Former recurring cadence | Current recurring cadence |
| --- | --- | --- | --- |
| `/admin/users/summary` | Admin | 60 seconds | 60 minutes |
| `/admin/users` (current page/filter/search) | Admin Accounts | 60 seconds | 60 minutes |
| `/admin/profile-edit-requests?page=...` | Admin Notifications, while pending requests exist | 60 seconds | 60 minutes |
| `/dashboard` | Admin, Teacher Dashboard, Student Home | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/me/profile-edit-request` | Profile View | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/classes` | Teacher class list; Student Materials | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/classes` | Notifications class list | 24 hours | 24 hours |
| `/announcements` | Notifications | `POLL_INTERVAL_TEN_MINUTES` (actually 60 minutes) | 60 minutes |
| `/notifications` | Notifications | `POLL_INTERVAL_TEN_MINUTES` (actually 60 minutes) | 60 minutes |
| `/classes/{id}/materials` | Student Class Workspace, Student List material count, Teacher Materials, Upload Page | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/classes/{id}/assessments` | Student Class Workspace, Student Assessments | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/classes/{id}/students` | Student Class Workspace classmate count, Student List roster | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/classes/{id}/progress` | Student Class Workspace | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/schedules` | Student Class Workspace, Student Home, Student Live, Teacher Meet | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/quiz-attempts` | Student Exams | `POLL_INTERVAL_TWO_MINUTES` (actually 60 minutes) | 60 minutes |
| `/me` | Teacher profile; Expiry Banner when given a user ID | 24 hours | 24 hours |
| `/settings/appearance` | System appearance hook | `watchApi` default (24 hours) | 24 hours |
| `/gospel-verses` | Gospel page | `watchApi` default (24 hours) | 24 hours |

`src/teacher/TeacherView.tsx` also contains a default-interval `/me` watcher,
but that component is not imported by the active Teacher screen.

## UI-only minute timers

These timers update local display state and do not poll the API. They remain at
60 seconds:

- The Gospel page refreshes its local date.
- The Expiry Banner refreshes its countdown.
- The unused `TeacherView` component refreshes its countdown.
