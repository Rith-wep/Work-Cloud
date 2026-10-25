# WorkCloud App Logic (Single-File System Overview)

This is the consolidated project guide and current implementation reference for Linklid / WorkCloud. It covers the implemented product features, architecture, data model, API, local setup, integrations, and production deployment checklist. Where deployment credentials or external accounts are required, the feature is implemented in code but is not considered production-ready until those values and provider settings are supplied and verified.

## 1. High-Level Architecture

- **Frontend**: React + Vite + Tailwind + Framer Motion + i18next
- **Backend**: Express + Mongoose + JWT + Socket.io
- **Database**: MongoDB Atlas (Mongoose models)
- **Media**: Cloudinary (candidate profile pictures and employer logo/cover images)
- **AI service**: FastAPI, MongoDB, optional Gemini API
- **Languages**: English, Khmer, Simplified Chinese

Core pattern:
- Candidate discovers jobs -> applies -> employer manages candidate -> handshake completion -> candidate gets trust updates.
- Employer creates/manages company jobs in isolated multi-tenant workspace (`companyId = employer user id`).

---

## 2. Backend Bootstrap and Middleware

Entrypoints: `server/src/app.js` configures Express middleware, routes, static serving, and health endpoints. `server/src/server.js` loads local development configuration, connects MongoDB, initializes Socket.IO, listens on the port, and handles graceful shutdown. `server/index.js` is a compatibility launcher.

- Loads environment variables via `dotenv.config()` at startup.
- Configures:
  - `cors` with explicit origins + localhost:* dev allowance
  - `helmet`
  - `express.json()`
- static frontend build serving when `client/dist` exists
- Mounts all APIs under `/api`.
- Connects MongoDB via `connectDB()`.
- Initializes Socket.io via `initializeSocket(httpServer, allowedOrigins)`.

Auth middleware:
- `protect`: verifies JWT from `Authorization: Bearer ...`.
- `restrictTo(...roles)`: role-based API access control.

---

## 3. Data Model (MongoDB)

### 3.1 User (`server/src/features/users/User.js`)

Key fields:
- Identity/auth: `name`, `email`, `password`, `role`, `accountType`
- Admin access: `adminRole` (`none|moderator|super_admin`)
- Trust/reputation: `trustScore`, `verifiedBadges`, `rating`, `verifiedApplicationsCount`
- Candidate profile: `phoneNumber`, `telegramUsername`, `bio`, `profilePicture`, `skills`, `languages`, `educationHistory`, `workExperience`, `preferredCategory`, `preferredCategories`, `preferredLocation`
- Employer/company profile: `companyName`, `companyLogo`, `companyCoverPicture`, `companyWebsite`, `companyAddress`, `companySize`, `companyLocation`, `businessRegistration`, `companyDescription`, `businessPhoneNumber`, `businessTelegramUsername`
- Contact preference: `preferredContactMethod` (`phone|telegram|none`)
- i18n: `preferredLanguage` (`en|km|zh`)
- Job links: `savedJobs`
- History: `history` (Application references)
- Geo: `location.geo` with `2dsphere` index
- `skills`, `languages`, and `educationHistory` are arrays of strings in the current Mongoose model; `workExperience` is a structured array of job title, date range, and bullet points.

### 3.2 Job (`server/src/features/jobs/Job.js`)

Key fields:
- Posting: `title`, `description`, `salary`, `category`, `requiredSkills`, `vacancies`, `hiredCount`, `hiringLimit`
- Ownership/tenant: `employerId`, `companyId` (required, indexed)
- Company snapshot at posting time: `companyProfile`
- Location: `location.lat`, `location.lng`, `location.address`, `location.geo` (`Point`, 2dsphere)
- Engagement/status: `views`, `metadata.views`, `status` (`open|closed|archived`), `applicants`
- Extra metadata: `jobType`, `urgency`, `paymentStatus`, `isFeatured`

### 3.3 Application (`server/src/features/applications/Application.js`)

Key fields:
- `jobId`, `candidateId`, `companyId` (required, indexed)
- `status`: `pending|accepted|contracted|awaiting_confirmation|rejected|no_show|completed`
- Handshake flags: `handshakeCompleted`, `arrivalRequestedAt`, `handshakeAt`
- CV sharing: `cvSnapshotUrl`, `cvSnapshot`
- Unique index: `(jobId, candidateId)` to prevent duplicate apply

`cvSnapshot` stores the candidate's professional CV state at apply-time, including:
- full name / headline / summary
- contact block
- profile picture
- skills / languages
- structured experience bullets
- structured education rows
- verified badge state

### 3.4 CandidateReview (`server/src/features/reviews/CandidateReview.js`)

Key fields:
- `candidateId`, `employerId`, `companyId`, `jobId`
- `rating` (1-5), `comment`
- Unique index: `(candidateId, companyId, jobId)` one review per candidate per company per job

### 3.5 Notification (`server/src/features/notifications/Notification.js`)

Key fields:
- `recipientId`, `senderId`, `senderName`, `senderProfilePic`
- `message`, `type`, `isRead`, `metadata`
- Types include: `new_application`, `job_accepted`, `job_rejected`, `arrival_submitted`, `arrival_confirmed`, `no_show_reported`, `system`

### 3.6 CatalogTerm (`server/src/features/users/CatalogTerm.js`)

Key fields:
- `kind`: `skill|category`
- `key`, `label`
- `usageCount`
- `createdBy`

Used to build a shared catalog of reusable skills/categories across onboarding, profile editing, and employer posting flows.

### 3.7 VerificationPayment (`server/src/features/payments/VerificationPayment.js`)

Key fields:
- `candidateId`
- `provider` (`aba_payway|bakong_khqr`; current default is `bakong_khqr`)
- `amount`, `currency`
- `status`: `pending|paid|failed|cancelled`
- `transactionId`, `providerTransactionId`
- `checkoutUrl`
- `metadata`
- `paidAt`

Used to track the candidate verification payment lifecycle for Bakong KHQR or ABA PayWay through successful trust/badge upgrade.

### 3.8 AuditLog (`server/src/features/admin/AuditLog.js`)

Key fields:
- `adminId`, `adminName`, `adminEmail`, `adminRole`
- `action`, `resourceType`, `resourceId`
- `targetIds`, `metadata`

Used to trace protected admin reads and edits across the admin console, and also system-level financial verification events for platform revenue tracking.

---

## 4. API Surface (Mounted under `/api`)

Source of truth: `server/src/routes/index.js` and feature routes under `server/src/features/`. All paths below are prefixed with `/api`. Protected requests require a bearer JWT; role restrictions are called out explicitly.

### 4.1 Health (`/api/health`)

- `GET /health`: returns a basic API-running response.
- `GET /health/ready`: returns 200 when MongoDB is connected, otherwise 503.
- `GET /health/live`: lightweight process liveness endpoint used by the container health check.

### 4.2 Authentication (`/api/auth`)

- `POST /register`: create a candidate or employer account; registration body is Zod-validated.
- `POST /login`: email/password login.
- `POST /google`: Google sign-in or account creation.
- `GET /me` (protected): return the authenticated user and admin role fields.
- `PATCH /me` (protected): update profile fields through the auth controller.
- `GET /catalog` (protected): retrieve shared skills and categories.
- `GET /employer-only` (protected, employer): role-check endpoint.

### 4.3 Jobs (`/api/jobs`)

- `GET /`: public job feed.
- `GET /:id`: public job details.
- `GET /my` (protected, employer): current employer's jobs.
- `GET /saved` (protected): current user's saved jobs.
- `POST /` (protected, employer): create a job.
- `PATCH /:id` (protected, employer): update an owned job.
- `DELETE /:id` (protected, employer): delete an owned job.
- `PATCH /:id/save` (protected): toggle save state.

### 4.4 Applications (`/api/applications`)

- `GET /my` and `GET /candidate` (protected, candidate): candidate application lists.
- `GET /employer` (protected, employer): applications for the employer.
- `GET /employer/job/:jobId/applicants` (protected, employer): applicants for one owned job.
- `GET /:id/cv-snapshot` (protected): application CV snapshot, access-checked for the candidate or job owner.
- `GET /candidate/:candidateId/reviews` (protected, employer): candidate reviews.
- `POST /` (protected, candidate): apply to a job.
- `PATCH /:id/handshake` (protected, candidate): submit arrival.
- `PATCH /:id/interview` (protected, employer): update interview details.
- `PATCH /:id/status` (protected, employer): update application status.
- `PATCH /:id/confirm-arrival` (protected, employer): confirm arrival/completion.
- `PATCH /:id/report-no-show` (protected, employer): report a no-show.

### 4.5 Reviews (`/api/reviews`)

- `POST /candidate` (protected, employer): create or update a candidate review. There is no mounted `/api/applications/:id/review` route in the current router.

### 4.6 Users (`/api/users`)

- `GET /employer/:id`: public employer profile.
- `GET /candidate/:id/public` (protected, employer): candidate public profile for an employer.
- `PATCH /profile` (protected): update user profile.
- `PATCH /update-language` (protected): update preferred language.
- `POST /cover-picture` (protected, employer): upload company cover image.
- `POST /employer/profile` (protected, employer): update employer profile and upload company logo.
- `PATCH /profile-picture` (protected, candidate): upload candidate profile picture.

### 4.7 Notifications (`/api/notifications`)

- `GET /` (protected): list current user's notifications.
- `PATCH /read-all` (protected): mark all notifications read.
- `PATCH /:id/read` (protected): mark one notification read.
- `DELETE /` (protected): clear all notifications.
- `DELETE /:id` (protected): delete one notification.

### 4.8 Stats (`/api/stats`)

- `GET /employer` (protected, employer): employer job/application statistics. No `/api/jobs/company/stats` or `/api/applications/employer/stats` route is currently mounted.

### 4.9 Admin (`/api/admin`)

All admin routes require an authenticated admin with at least moderator access; sensitive routes require super-admin access.

- `GET /catalog`: catalog dashboard.
- `GET /catalog/ai-suggestions`: AI merge suggestions.
- `POST /catalog/merge` (super admin): merge catalog terms.
- `GET /all-users` (super admin): user directory.
- `GET /all-jobs` (super admin): job moderation list.
- `GET /stats` (super admin): platform metrics.
- `GET /audit-logs` (super admin): audit history.

### 4.10 Payments (`/api/payments`)

- `POST /verification/initiate`, `POST /verification/bakong/initiate`, and `POST /verification/aba/initiate` (protected, candidate): initiate verification payment by the corresponding backend flow. The current candidate modal uses Bakong KHQR.
- `GET /status/:tranId` (protected, candidate): query a candidate payment status.
- `POST /verification/finalize` and `POST /verification/aba/finalize` (protected, candidate): finalize payment.
- `GET|POST /callback`, `GET|POST /verification/aba/callback`, and `GET|POST /verification/bakong/callback`: provider callback handlers.

### 4.11 Router notes

The Express router mounts the health, auth, jobs, applications, admin, users, notifications, payments, stats, and reviews routers. No refresh-token endpoint is currently registered.

---

## 5. Core Business Logic

## 5.1 Multi-Tenant Isolation

- `companyId` is the tenancy key.
- Employer can only read/update jobs/applications where `companyId` matches authenticated employer id.
- Application status updates force-sync `application.companyId = req.user.id` for strict consistency.

## 5.2 Job Lifecycle

- Created by employer with required location coordinates.
- Employer can define `vacancies` ("Number of Openings"); legacy `hiringLimit` is kept aligned for backward compatibility.
- Employer can set `requiredSkills` via multi-tag input with category-based suggestions.
- Public feed/map shows open jobs.
- Employer can archive/close/delete.
- View count increments on each `GET /jobs/:id`.
- Job detail fetch live-syncs `hiredCount` from application states to avoid stale occupancy data on older records.

Vacancy / closure logic:
- `hiredCount` is derived from hire-counted application states: `accepted`, `contracted`, `awaiting_confirmation`, `completed`.
- If `hiredCount >= vacancies`, the job is auto-closed.
- Auto-closure emits a system notification to the employer.
- Candidates cannot apply to jobs that are closed or already fully filled.

## 5.3 Application Lifecycle

Typical statuses:
- `pending` -> `contracted` (via accept) -> `awaiting_confirmation` (candidate arrived) -> `completed` (employer confirms)
- Alternative outcomes: `rejected` or `no_show`.

Hiring side effects:
- Employer "accept" / "hired" actions normalize to `contracted`.
- Each employer status mutation triggers job hiring-progress recalculation.
- Status changes that reduce active hires (`rejected`, `no_show`) also recalculate counts so `hiredCount` stays accurate.

## 5.4 Trust & Reputation

- Handshake confirm: +10 trust.
- Report no-show: -20 trust.
- Trust score is bounded with guardrails: minimum 0, maximum 100.
- Candidate review trust impact by rating:
  - 1: -10
  - 2: -5
  - 3: 0
  - 4: +5
  - 5: +10
- Review edits adjust trust by **difference** between old and new rating impact.
- `verifiedApplicationsCount` is synchronized with completed verified history (`history`) and updated on employer confirmation flow.

## 5.5 Save/Share

- Save toggles stored in `User.savedJobs`.
- Share uses Web Share API when available, clipboard fallback.

## 5.6 Employer Company Profile Logic

- Employer profile editing supports:
  - `companyName`
  - `companyLogo`
  - `companyCoverPicture`
  - `companyWebsite`
  - `companyAddress`
  - `companySize`
  - `businessRegistration`
  - `companyDescription`
  - `businessPhoneNumber`
  - `businessTelegramUsername`
  - `preferredContactMethod`
- Company profile data is serialized into auth/user payloads and reused in:
  - employer profile page
  - employer public profile page
  - job company snapshot UI
  - company preview cards

## 5.7 Shared Catalog Logic

- Candidate onboarding, candidate profile skill/category entry, and employer job posting all read from a shared catalog.
- New normalized skill/category terms are auto-synced into `CatalogTerm` when relevant profile/job updates happen.
- Catalog merge tools exist for admin cleanup to keep suggestion quality high.

## 5.8 Candidate CV Profile and Export Logic

- Candidate profile editing includes a dedicated CV workflow layered on top of the main profile.
- The CV editor supports:
  - profile photo
  - phone
  - professional summary
  - skills
  - languages
  - education history with start/end dates
  - work experience with start/end dates and bullet points
- `Save & Update Profile` writes the CV-relevant profile fields back to the main user profile so matching logic stays aligned with the candidate's latest data.
- CV preview is shown before download inside a full-screen document modal.
- PDF output uses a professional two-column layout with:
  - sidebar contact / skills / languages
  - main summary / experience / education
  - WorkCloud verified badge when candidate is verified
- Skill labels are scrubbed from machine keys to professional English titles.
- Education and experience date ranges are preserved and rendered into the preview/PDF.

## 5.9 CV Snapshot Sharing Logic

- Applying to a job freezes a snapshot of the candidate's CV at that moment.
- Candidate "Applied Jobs" view can reopen the stored snapshot preview.
- Employer applicant views read the stored application snapshot, not the candidate's live profile.
- Privacy guardrails ensure only:
  - the candidate who owns the application
  - the employer who owns the job
  can access a snapshot URL.

## 5.10 AI CV Assist Logic

Path: `ai-service/app/cv_service.py`

Current AI modes:
- `summary`: generates a professional English summary using selected skills, work experience, and role context
- `experience`: generates 3 achievement-style bullet points + 3 keyword chips
- `refine`: rewrites user-entered text into professional English
- `health`: computes CV quality score + improvement tip

Behavioral constraints:
- Professional English output only for CV content
- Role-aware prompting with fallback role families (driver, cashier, receptionist, sales)
- Duration-aware phrasing for early-career vs long-tenure experience
- STAR-style, anti-fluff generation guardrails
- Local fallback generation when Gemini is unavailable
- Experience helper payload includes job title, selected skills, experience level, technical context, and duration hints

Frontend AI UX:
- AI summary magic button
- AI experience helper
- AI keyword chips for experience description assistance
- CV health score with improvement tip
- Khmer loading message for slow AI generation
- Accepted AI suggestions sync back into profile state and profile save flow

## 5.11 Candidate Verification Payment Flow

- Candidate verification is a paid upgrade flow. The current modal generates a Bakong KHQR payment for `$1.00 USD` and polls payment status.
- The server creates a unique payment reference and stores it in `VerificationPayment`; Bakong configuration is read from `BAKONG_*` environment variables.
- An ABA PayWay integration is also implemented in the backend and uses `ABA_PAYWAY_*` settings, but the current modal does not select it.
- Successful finalize logic:
  - marks the payment as `paid`
  - adds `+10` to `trustScore`
  - adds `Verified` to `verifiedBadges`
  - sets `isVerified = true`
- Duplicate verification is blocked once the candidate is already verified.
- Successful payment completion also records a system audit entry under `resourceType = verification_payment`.
- Finalization and status checks are provider-aware. Do not treat a browser return by itself as proof of payment; configure provider callbacks/status verification and test the full flow before launch.
- Production availability depends on live merchant credentials, enabled callback URLs, and payment provider approval.

---

## 6. Real-Time Notification System (Socket.io)

Server:
- Socket handshake validates JWT.
- User joins room: `user:<userId>`.
- `createAndEmitNotification()` persists notification, populates sender, emits `new_notification` to recipient room.
- Candidate verification success emits `verification_completed` to the candidate room for immediate UI refresh / celebration.

Client:
- `NotificationContext` connects socket after login.
- On `new_notification`, prepends notification list and triggers visual toast.
- Supports mark-one and mark-all read API actions.
- On `verification_completed`, refreshes the current user and dispatches a local event so the verification success screen can animate the new rank immediately.

---

## 7. Frontend App Structure and Routing

Files:
- Main app: `client/src/App.jsx`
- Admin app: `client/src/admin/AdminApp.jsx`
- Shared providers: `client/src/bootstrap/AppProviders.jsx`

Public routes:
- `/` -> redirects authenticated users to the role home; unauthenticated users go to `/login`
- `/login`
- `/register`
- `/register-company`
- `/employers`

Protected routes:
- Shared shell with `MainLayout`
- Common: `/jobs`, `/map`, `/jobs/:jobId`, `/notifications`, `/profile`
- Candidate-only: `/my-apps`, `/apply`, `/saved-jobs`
- Employer-only: `/post-job`, `/jobs/:jobId/edit`, `/my-postings`, `/workspace`, `/manage-applications`

Admin routes:
- Main shell redirect route: `/admin/login` -> redirects to main login or separate admin origin
- Separate admin shell entry:
  - `/login`
  - `/`
  - `/users`
  - `/jobs`
  - `/catalog`
  - `/audit-logs`

Admin routing/access:
- Admin shell is separated from the main app shell.
- Moderators can access the admin console but super-admin-only pages/data are guarded in both UI and API.
- Host/origin helpers support an `admin.workcloud.com` style admin plane deployment.

Smart redirect:
- Authenticated employer root redirect -> `/workspace`
- Authenticated candidate root redirect -> `/jobs`

---

## 8. Frontend State Contexts

## 8.1 AuthContext

- Handles login/register/logout/session restore.
- Stores token/user in localStorage or sessionStorage based on remember-me.
- Fetches `/auth/me` to refresh user.
- Handles language preference sync (`preferredLanguage`) with `i18n`.
- Shared across both the main app entry and the separate admin entry.
- Carries admin payload fields including `isAdmin` and `adminRole`.

## 8.2 NotificationContext

- Fetches notification history from API.
- Maintains socket connection.
- Emits toast UI on incoming notification.
- Shared by both entries through `AppProviders`.

## 8.3 AppContext

- Minimal generic user state container (legacy/simple context).

---

## 9. i18n (EN/KM/ZH)

File: `client/src/i18n.js`

- Uses `i18next` + `react-i18next` + `LanguageDetector`.
- Supported languages: `en`, `km`, `zh`.
- Detection order: localStorage, then navigator.
- Key `preferredLanguage` persists language.
- `AuthContext` updates language on login/register/refresh and optionally syncs server profile.

---

## 10. Media and Profile Picture Flow

- Candidate uploads via `PATCH /api/users/profile-picture`.
- Backend uploads image buffer to Cloudinary and stores `secure_url` in `User.profilePicture`.
- UI normalizes to HTTPS Cloudinary URLs.
- Lazy avatar component shows fallback initial while image is loading/fails.

---

## 11. Workspace and Dashboard Logic (Employer)

ManageApplications page combines:
- **Applications tab**:
  - Candidate cards with trust, verified applications, success rate, quick contact
  - Actions: accept/contract, reject, confirm arrival, report no-show
  - Candidate review block (enabled only for completed applications)
- **My Listings tab**:
  - Employer jobs with edit/archive/delete and applicant/hired/remaining counters
- **Company Settings tab**:
  - Business contact and company settings update

Summary cards:
- Active Jobs
- Filled Jobs
- Total Jobs

Additional listing logic:
- Listing cards surface `hiredCount / vacancies`.
- Remaining spots are derived as `vacancies - hiredCount`.
- Filled badge is based on `hiredCount >= vacancies`.

---

## 12. Candidate Experience Logic

- Job feed with category + search + salary filters.
- Job card interactions:
  - Clicking company avatar/name opens company public profile (`/employers/:id`).
  - Clicking map preview opens Google Maps to job/company location.
- The job-card public question/comment box is currently component-local state; comments are not saved to the server and disappear when the card unmounts or reloads.
- Job cards and map previews show top 3 required skills as tags.
- Skill match logic compares candidate `user.skills` with `job.requiredSkills`; matched skills are highlighted in green.
- Map discovery with marker interactions.
- Apply flow and "I have Arrived" handshake submission.
- Job details highlight fill progress (for example: `1 of 3 positions filled`) and disable application when the job is already filled.
- Saved jobs collection.
- Profile page with trust gauge and handshake logs.

Map details (candidate):
- Marker click opens bottom job preview with salary + actions.
- Recenter uses Geolocation API and now drops a visible "You are here" marker point.

Map details (employer):
- Talent mode data source is employer applications for employer-owned **active jobs** (inactive: `closed`, `archived` excluded).
- Candidate markers are no longer hard-filtered by 10km; distance is computed (if company location exists) and used for sorting/display.
- If candidate GPS is missing, marker falls back to applied job location so applicants remain visible.
- Marker/list preview shows trust score + application status + verified contact.

---

## 13. Loading/UX Strategy

Implemented loading patterns:
- Skeleton components:
  - `SkeletonCard` for job-feed/listing style
  - `SkeletonProfile` for candidate/application cards
- Lazy avatar loading with placeholder initials (`LazyAvatar`)
- Button loading/spinner states on critical actions (`Accept & Contract`, `Save Review`, etc.)
- Top route progress bar (`RouteProgressBar`) for transitions between major dashboard pages

---

## 14. Security and Validation Notes

- Passwords hashed via bcrypt.
- JWT signed with `JWT_SECRET`; auth endpoints guard secret-missing cases.
- Role guards (`restrictTo`) prevent cross-role access.
- Admin level guards restrict moderator vs super-admin abilities.
- Tenant checks enforced in update/delete/status/review handlers.
- Category validation and coordinate validation on job creation/update.
- Contact method consistency validation in profile updates.
- Vacancy validation enforces minimum `1` and prevents shrinking vacancies below current hires.

---

## 15. Environment Variables (Important)

Backend (`server/.env`; use `server/.env.example` as a template and replace every example value):
- `PORT`
- `MONGODB_URI`
- `MONGO_DB_NAME` (AI service DB selection; defaults to `test`)
- `GEMINI_API_KEY` (Gemini extraction for AI bot)
- `GEMINI_MODEL` (optional override; fallback model list is built-in)
- `JWT_SECRET`
- `CLIENT_ORIGIN` or `CLIENT_ORIGINS`
- `ADMIN_ORIGIN` or `ADMIN_ORIGINS`
- `SUPER_ADMIN_EMAILS`
- `MODERATOR_EMAILS`
- Bakong verification settings used by the current modal:
  - `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_ID`, `BAKONG_MERCHANT_NAME`, `BAKONG_MERCHANT_CITY`, `BAKONG_ACQUIRING_BANK`
  - optional `BAKONG_MOBILE_NUMBER`, `BAKONG_STORE_LABEL`, `BAKONG_TERMINAL_LABEL`, `BAKONG_MERCHANT_CATEGORY_CODE`, `BAKONG_EXPIRATION_MINUTES`, `BAKONG_KHQR_IMAGE`
  - `BAKONG_CALLBACK_URL`, `BAKONG_BEARER_TOKEN`, `BAKONG_CHECK_TRANSACTION_URL`
- Optional ABA PayWay backend integration settings:
  - `ABA_PAYWAY_MERCHANT_ID`
  - `ABA_PAYWAY_API_KEY`
  - `ABA_PAYWAY_CHECKOUT_URL`
  - `ABA_PAYWAY_CHECK_TRANSACTION_URL`
  - `MAIN_APP_ORIGIN` or `CLIENT_ORIGIN` or `CLIENT_ORIGINS`
- Cloudinary settings:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - optional `CLOUDINARY_UPLOAD_PRESET`

Frontend (`client/.env`):
- `VITE_API_BASE_URL` (e.g. `http://localhost:5000/api`)
- `VITE_AI_API_BASE_URL` (AI service base URL, default `http://localhost:8000`)
- `VITE_MAIN_APP_ORIGIN`
- `VITE_ADMIN_APP_ORIGIN`
- `VITE_GOOGLE_CLIENT_ID` (Google sign-in; also listed in the deployment guide)
- `VITE_GOOGLE_MAPS_API_KEY` (maps, address search, and map previews)

AI service configuration reads `MONGODB_URI`, optional `MONGO_DB_NAME`, and `GEMINI_API_KEY` / `GEMINI_MODEL` from environment variables. The service defaults to port `8000`; configure `VITE_AI_API_BASE_URL` in the frontend and `AI_API_BASE_URL` for server-side admin catalog suggestions as needed.

Local multi-entry development:
- Main Vite entry runs on `http://localhost:5173`
- Admin Vite entry runs on `http://localhost:5174/admin.html`
- Admin local routing uses `HashRouter` to avoid dev-server rewrite conflicts

## 16. Current Known Design Choices

- Candidate reviews use `POST /api/reviews/candidate`. Employer dashboard statistics use `GET /api/stats/employer`.
- Candidate verified applications now prefer `verifiedApplicationsCount`, fallback to `history.length` for compatibility.
- `hiringLimit` still exists on `Job` for backward compatibility, but the current source of truth for openings is `vacancies`.
- Admin analytics now treat recruitment efficiency as:
  - total vacancies
  - total hires
  - fully staffed jobs
  - recruitment fill rate

---

## 17. Admin Console Logic

- Admin access is derived from `User.adminRole`.
- `moderator`:
  - can access the admin shell
  - can view catalog dashboard and AI merge suggestions
- `super_admin`:
  - full platform overview
  - user directory
  - job moderation
  - audit logs
  - catalog merge execution

Admin observability:
- The implemented admin dashboard, catalog views/merge, user/job listings, stats, and audit-log reads record `AuditLog` entries.
- Dashboard surfaces:
  - total users
  - active jobs
  - application matching success rate
  - recruitment efficiency metrics
- Job moderation table includes hiring progress (`hiredCount / vacancies`) in addition to applications.

Frontend admin shell architecture:
- Main app and admin app are emitted as separate Vite entry points:
  - `index.html`
  - `admin.html`
- Admin-specific UI is isolated into an admin bundle / chunk group.
- Host-based redirect helpers route users to the correct frontend origin for:
  - `workcloud.com`
  - `admin.workcloud.com`

---

## 18. AI Job Bot Service (Modular FastAPI)

Path: `ai-service/app/` (the legacy `server/ai_service/` directory is retained during migration).

Current module split:
- `main.py`: FastAPI app creation, CORS middleware, Mongo client lifecycle, route wiring
- `models.py`: request schema (`AIJobSearchRequest`)
- `constants.py`: categories, aliases, keyword/hint lists, regex pattern lists
- `utils.py`: shared helpers (`normalize_text`, `parse_json_object`, `salary_to_int`, etc.)
- `extractors.py`: intent/filter extraction and normalization fallback chain
- `gemini_service.py`: Gemini prompt call + parse + fallback handoff
- `job_service.py`: query composition, filtering, scoring, ranking, and response payload builder
- `messages.py`: localized greeting/identity/out-of-scope messages

Route contract:
- `POST /api/ai/job-search`: conversational job discovery; response type can be `greeting`, `out_of_scope`, or `job_results`.
- `POST /api/ai/cv-assist`: CV `summary`, `experience`, `refine`, and `health` assistance.
- `POST /api/ai/catalog-merge-suggestions`: catalog term merge suggestions. The Express admin proxy calls this endpoint and falls back to heuristic suggestions.
- Job search output includes `success`, `intent`, `filters`, `count`, `jobs`, and `chat_message`; out-of-scope responses can include `show_tips` and `tips_categories`.

The FastAPI routes are separate from Express and do not apply authentication middleware themselves. In the Compose setup, the AI service stays on the private network and is reached through the web proxy. Restrict network access or add service authentication in other deployment topologies.

Behavioral notes:
- Gemini response parsing is strict JSON-first with graceful fallback to regex/rule extractors.
- Intent guardrails: greeting/personality/out-of-scope are separated before DB query.
- Job search supports combined filters: category, role keywords, skills, location, salary range, remote, experience, tier.
- Tier filter set supports: `remote`, `no_experience`, `junior`, `senior`.
- Ranking uses `matchScore` + recency tie-break (`createdAt`) with location-relaxed fallback query if needed.

---

## 19. Quick Mental Model (TL;DR)

- **Candidate** finds jobs -> applies -> can mark arrival -> gets trust through employer confirmation/reviews.
- **Employer** posts and manages company-isolated jobs -> manages applicants -> fills tracked vacancies -> auto-closes fully staffed jobs -> confirms arrival/no-show -> rates candidates.
- **Admin** monitors users/jobs/catalog/audit activity through a role-gated control plane with super-admin-only analytics and merge actions.
- **System** tracks trust and reputation, company profile state, shared catalog quality, recruitment fill progress, real-time notifications, language/profile preferences, and a responsive mobile-first UI with professional loading states.

---

## 20. Setup and Deployment References

For current local development commands, environment setup, and production guidance, see:

- [Project README](../README.md)
- [Deployment notes](deployment.md)
- [Docker deployment guide](docker.md)
- [Client hosting configuration](../client/DEPLOYMENT.md)