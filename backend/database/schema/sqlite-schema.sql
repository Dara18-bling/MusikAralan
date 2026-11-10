CREATE TABLE "migrations"(
  "id" integer primary key autoincrement not null,
  "migration" varchar not null,
  "batch" integer not null
);
CREATE TABLE "password_reset_tokens"(
  "email" varchar not null,
  "token" varchar not null,
  "created_at" datetime,
  primary key("email")
);
CREATE TABLE "sessions"(
  "id" varchar not null,
  "user_id" integer,
  "ip_address" varchar,
  "user_agent" text,
  "payload" text not null,
  "last_activity" integer not null,
  primary key("id")
);
CREATE INDEX "sessions_user_id_index" on "sessions"("user_id");
CREATE INDEX "sessions_last_activity_index" on "sessions"("last_activity");
CREATE TABLE "cache"(
  "key" varchar not null,
  "value" text not null,
  "expiration" integer not null,
  primary key("key")
);
CREATE INDEX "cache_expiration_index" on "cache"("expiration");
CREATE TABLE "cache_locks"(
  "key" varchar not null,
  "owner" varchar not null,
  "expiration" integer not null,
  primary key("key")
);
CREATE INDEX "cache_locks_expiration_index" on "cache_locks"("expiration");
CREATE TABLE "jobs"(
  "id" integer primary key autoincrement not null,
  "queue" varchar not null,
  "payload" text not null,
  "attempts" integer not null,
  "reserved_at" integer,
  "available_at" integer not null,
  "created_at" integer not null
);
CREATE INDEX "jobs_queue_index" on "jobs"("queue");
CREATE TABLE "job_batches"(
  "id" varchar not null,
  "name" varchar not null,
  "total_jobs" integer not null,
  "pending_jobs" integer not null,
  "failed_jobs" integer not null,
  "failed_job_ids" text not null,
  "options" text,
  "cancelled_at" integer,
  "created_at" integer not null,
  "finished_at" integer,
  primary key("id")
);
CREATE TABLE "failed_jobs"(
  "id" integer primary key autoincrement not null,
  "uuid" varchar not null,
  "connection" varchar not null,
  "queue" varchar not null,
  "payload" text not null,
  "exception" text not null,
  "failed_at" datetime not null default CURRENT_TIMESTAMP
);
CREATE INDEX "failed_jobs_connection_queue_failed_at_index" on "failed_jobs"(
  "connection",
  "queue",
  "failed_at"
);
CREATE UNIQUE INDEX "failed_jobs_uuid_unique" on "failed_jobs"("uuid");
CREATE TABLE "classes"(
  "id" integer primary key autoincrement not null,
  "legacy_id" varchar,
  "name" varchar not null,
  "teacher_id" integer,
  "age_group" varchar not null default 'all',
  "description" text,
  "available_for_enrollment" tinyint(1) not null default '0',
  "deleted" tinyint(1) not null default '0',
  "enrollment_updated_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("teacher_id") references "users"("id") on delete set null
);
CREATE UNIQUE INDEX "classes_legacy_id_unique" on "classes"("legacy_id");
CREATE TABLE "enrollments"(
  "id" integer primary key autoincrement not null,
  "class_id" integer not null,
  "student_id" integer not null,
  "enrolled_at" datetime not null default CURRENT_TIMESTAMP,
  foreign key("class_id") references "classes"("id") on delete cascade,
  foreign key("student_id") references "users"("id") on delete cascade
);
CREATE UNIQUE INDEX "enrollments_class_id_student_id_unique" on "enrollments"(
  "class_id",
  "student_id"
);
CREATE TABLE "assessment_questions"(
  "id" integer primary key autoincrement not null,
  "assessment_id" integer not null,
  "position" integer not null,
  "prompt" text not null,
  "type" varchar not null,
  "options" text,
  "correct_option_index" integer,
  "correct_answer" text,
  foreign key("assessment_id") references "assessments"("id") on delete cascade
);
CREATE UNIQUE INDEX "assessment_questions_assessment_id_position_unique" on "assessment_questions"(
  "assessment_id",
  "position"
);
CREATE TABLE "assessment_attempt_answers"(
  "id" integer primary key autoincrement not null,
  "attempt_id" integer not null,
  "question_id" integer not null,
  "answer" text,
  "correct" tinyint(1) not null,
  foreign key("attempt_id") references "assessment_attempts"("id") on delete cascade,
  foreign key("question_id") references "assessment_questions"("id") on delete cascade
);
CREATE UNIQUE INDEX "assessment_attempt_answers_attempt_id_question_id_unique" on "assessment_attempt_answers"(
  "attempt_id",
  "question_id"
);
CREATE TABLE "material_completions"(
  "id" integer primary key autoincrement not null,
  "student_id" integer not null,
  "material_id" integer not null,
  "completed_at" datetime not null default CURRENT_TIMESTAMP,
  foreign key("student_id") references "users"("id") on delete cascade,
  foreign key("material_id") references "materials"("id") on delete cascade
);
CREATE UNIQUE INDEX "material_completions_student_id_material_id_unique" on "material_completions"(
  "student_id",
  "material_id"
);
CREATE TABLE "chatbot_responses"(
  "id" integer primary key autoincrement not null,
  "legacy_key" varchar,
  "keywords" text not null,
  "response" text not null,
  "deleted" tinyint(1) not null default '0',
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "chatbot_responses_legacy_key_unique" on "chatbot_responses"(
  "legacy_key"
);
CREATE TABLE "settings"(
  "key" varchar not null,
  "value" text not null,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("key")
);
CREATE TABLE "personal_access_tokens"(
  "id" integer primary key autoincrement not null,
  "tokenable_type" varchar not null,
  "tokenable_id" integer not null,
  "name" text not null,
  "token" varchar not null,
  "abilities" text,
  "last_used_at" datetime,
  "expires_at" datetime,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_index" on "personal_access_tokens"(
  "tokenable_type",
  "tokenable_id"
);
CREATE UNIQUE INDEX "personal_access_tokens_token_unique" on "personal_access_tokens"(
  "token"
);
CREATE INDEX "personal_access_tokens_expires_at_index" on "personal_access_tokens"(
  "expires_at"
);
CREATE TABLE "voice_groups"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "description" text,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "voice_groups_name_unique" on "voice_groups"("name");
CREATE TABLE "user_voice_group"(
  "user_id" integer not null,
  "voice_group_id" integer not null,
  "voice_part" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("voice_group_id") references "voice_groups"("id") on delete cascade,
  primary key("user_id", "voice_group_id")
);
CREATE TABLE "modules"(
  "id" integer primary key autoincrement not null,
  "class_id" integer,
  "title" varchar not null,
  "category" varchar,
  "description" text,
  "created_by" integer,
  "requires_practice" tinyint(1) not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("class_id") references "classes"("id") on delete set null,
  foreign key("created_by") references "users"("id") on delete set null
);
CREATE INDEX "modules_class_id_created_at_index" on "modules"(
  "class_id",
  "created_at"
);
CREATE TABLE "materials"(
  "id" integer primary key autoincrement not null,
  "class_id" integer not null,
  "legacy_id" varchar,
  "teacher_id" integer,
  "title" varchar not null,
  "description" text not null,
  "kind" varchar not null,
  "media_url" text,
  "stream_url" text,
  "storage_path" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  "module_id" integer,
  "voice_group_id" integer,
  foreign key("teacher_id") references "users"("id") on delete set null on update no action,
  foreign key("class_id") references "classes"("id") on delete cascade on update no action,
  foreign key("module_id") references "modules"("id") on delete set null,
  foreign key("voice_group_id") references "voice_groups"("id") on delete set null
);
CREATE UNIQUE INDEX "materials_class_id_legacy_id_unique" on "materials"(
  "class_id",
  "legacy_id"
);
CREATE TABLE "assessments"(
  "id" integer primary key autoincrement not null,
  "class_id" integer not null,
  "title" varchar not null,
  "passing_percent" integer not null default('70'),
  "created_at" datetime,
  "updated_at" datetime,
  "module_id" integer,
  "assessment_code" varchar not null default 'A1',
  foreign key("class_id") references "classes"("id") on delete cascade on update no action,
  foreign key("module_id") references "modules"("id") on delete set null
);
CREATE TABLE "announcements"(
  "id" integer primary key autoincrement not null,
  "legacy_id" varchar,
  "author_id" integer,
  "title" varchar not null,
  "content" text not null,
  "created_at" datetime,
  "updated_at" datetime,
  "target_group_id" integer,
  foreign key("author_id") references "users"("id") on delete set null on update no action,
  foreign key("target_group_id") references "voice_groups"("id") on delete set null
);
CREATE UNIQUE INDEX "announcements_legacy_id_unique" on "announcements"(
  "legacy_id"
);
CREATE TABLE "users"(
  "id" integer primary key autoincrement not null,
  "firebase_uid" varchar,
  "name" varchar not null default(''),
  "email" varchar not null,
  "email_verified_at" datetime,
  "birthday" date,
  "birth_year" integer,
  "phone_number" varchar,
  "phone_verified" tinyint(1) not null default('0'),
  "messenger_link" varchar,
  "role" varchar not null default('student'),
  "status" varchar not null default('pending'),
  "access_until" date,
  "date_requested" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  "password" varchar,
  "approved_by" integer,
  "approved_at" datetime,
  foreign key("approved_by") references "users"("id") on delete set null
);
CREATE UNIQUE INDEX "users_email_unique" on "users"("email");
CREATE UNIQUE INDEX "users_firebase_uid_unique" on "users"("firebase_uid");
CREATE TABLE "module_progress"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "module_id" integer not null,
  "status" varchar not null default 'not_started',
  "completed_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("module_id") references "modules"("id") on delete cascade
);
CREATE UNIQUE INDEX "module_progress_user_id_module_id_unique" on "module_progress"(
  "user_id",
  "module_id"
);
CREATE TABLE "assessment_attempts"(
  "id" integer primary key autoincrement not null,
  "assessment_id" integer not null,
  "student_id" integer not null,
  "legacy_key" varchar,
  "score" integer not null,
  "passed" tinyint(1) not null,
  "submitted_at" datetime not null default(CURRENT_TIMESTAMP),
  "module_progress_id" integer,
  "status" varchar not null default 'failed',
  foreign key("student_id") references "users"("id") on delete cascade on update no action,
  foreign key("assessment_id") references "assessments"("id") on delete cascade on update no action,
  foreign key("module_progress_id") references "module_progress"("id") on delete set null
);
CREATE UNIQUE INDEX "assessment_attempts_legacy_key_unique" on "assessment_attempts"(
  "legacy_key"
);
CREATE INDEX "assessment_attempts_student_id_assessment_id_index" on "assessment_attempts"(
  "student_id",
  "assessment_id"
);
CREATE INDEX "assessment_attempts_module_progress_id_status_index" on "assessment_attempts"(
  "module_progress_id",
  "status"
);
CREATE TABLE "practice_sessions"(
  "id" integer primary key autoincrement not null,
  "module_progress_id" integer not null,
  "practice_type" varchar not null,
  "score" integer,
  "completed_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("module_progress_id") references "module_progress"("id") on delete cascade
);
CREATE INDEX "practice_sessions_module_progress_id_practice_type_index" on "practice_sessions"(
  "module_progress_id",
  "practice_type"
);
CREATE TABLE "notifications"(
  "id" varchar not null,
  "type" varchar not null,
  "notifiable_type" varchar not null,
  "notifiable_id" integer not null,
  "data" text not null,
  "read_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE INDEX "notifications_notifiable_type_notifiable_id_index" on "notifications"(
  "notifiable_type",
  "notifiable_id"
);
CREATE TABLE "schedule_events"(
  "id" integer primary key autoincrement not null,
  "class_id" integer,
  "created_by" integer not null,
  "title" varchar not null,
  "description" text,
  "starts_at" datetime not null,
  "join_url" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("class_id") references "classes"("id") on delete cascade,
  foreign key("created_by") references "users"("id") on delete cascade
);
CREATE INDEX "schedule_events_class_id_starts_at_index" on "schedule_events"(
  "class_id",
  "starts_at"
);
CREATE TABLE "gospel_verses"(
  "id" integer primary key autoincrement not null,
  "book" varchar not null,
  "chapter" integer not null,
  "verse" integer not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "gospel_verses_book_chapter_verse_unique" on "gospel_verses"(
  "book",
  "chapter",
  "verse"
);
CREATE UNIQUE INDEX "assessments_class_id_assessment_code_unique" on "assessments"(
  "class_id",
  "assessment_code"
);

INSERT INTO migrations VALUES(1,'0001_01_01_000000_create_users_table',1);
INSERT INTO migrations VALUES(2,'0001_01_01_000001_create_cache_table',1);
INSERT INTO migrations VALUES(3,'0001_01_01_000002_create_jobs_table',1);
INSERT INTO migrations VALUES(4,'2026_10_21_000001_create_learning_tables',1);
INSERT INTO migrations VALUES(5,'2026_10_21_000002_add_password_authentication_to_users',1);
INSERT INTO migrations VALUES(6,'2026_10_21_145031_create_personal_access_tokens_table',1);
INSERT INTO migrations VALUES(7,'2026_10_22_000001_integrate_voice_groups_modules_and_progress',2);
INSERT INTO migrations VALUES(8,'2026_10_22_000002_create_notifications_table',2);
INSERT INTO migrations VALUES(9,'2026_10_23_000001_create_schedule_events_table',2);
INSERT INTO migrations VALUES(10,'2026_10_24_000001_create_gospel_verses_table',2);
INSERT INTO migrations VALUES(11,'2026_10_26_000001_allow_multiple_class_assessments',2);
INSERT INTO migrations VALUES(12,'2026_10_27_000001_add_liturgical_palettes_to_appearance_setting',3);
