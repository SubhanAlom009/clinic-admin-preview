# changelog

# All notable changes to this project will be documented in this file.

## [2025-08-31] Added/Fixed
- Added a collapsable feature in the sidebar for better navigation.

## [2025-09-04] Added/Fixed

### 🔧 UI & Calendar Features
- Fixed notification queries and refetch logic across the app to use the `status` column (values: `unread` / `read`) instead of a boolean `read` column — resolved 400 errors when marking notifications as read (see `src/components/Layout.tsx` and `src/components/NotificationCenter.tsx`).
- Implemented a production-ready calendar view component at `src/components/CalendarView.tsx` using `react-big-calendar`.
	- Calendar shows appointments with color-coded status badges, a custom toolbar, and an appointment details modal with quick status actions.
- Integrated the calendar into the Appointments page (`src/pages/Appointments.tsx`) and added a view toggle (list ↔ calendar).
- Aligned the Calendar component with existing DB/types (used `appointment_datetime`, `duration_minutes`, `patients.name`, `doctors.name`, etc.) and adjusted the queries to fetch related patient/doctor rows.
- Addressed several TypeScript/type mismatches while wiring the calendar and appointments integration; added small, explicit type casts where needed to work around Supabase client typing for updates (temporary, low-risk).
- Improved status update flow for appointments (client mutation + query invalidation) and added UI controls to mark Check-In / Start / Complete / No-Show / Cancel from the calendar event modal.
- Minor UI and accessibility tweaks: toolbar buttons, status badge styling, and loading state for calendar.
- Added Company logo in the header of the `layout` component for consistent branding across all pages.
- Fixed the collapsable sidebar to ensure it works correctly on all screen sizes.
- Added a `Go back to Home` button in the header of the dashboard to allow users to easily navigate back to the landing page.
- Updated the `landing page` navbar so that after signing in, the user's information (such as name or clinic name) is displayed instead of the "Sign In" button, providing a personalized experience.

### 🚀 **MAJOR: Database Schema Consolidation**
- **BREAKING CHANGE**: Consolidated 4+ fragmented migration files into 2 comprehensive, production-ready migrations:
  - `20250904_comprehensive_schema.sql` - Complete clinic database schema (600+ lines)
  - `20250904_queue_functions.sql` - Advanced queue management functions (400+ lines)
- **Moved old migrations to `backup_old_migrations/` folder** to prevent conflicts and schema duplication issues
- **Enhanced appointment system** with advanced queue management:
  - Queue positions, ETAs, check-in status tracking
  - Real-time queue recalculation with PostgreSQL functions
  - Distributed locking system for concurrent operations
  - Event-driven notifications and job processing
- **Added robust tables**:
  - `job_queue` - Background job processing with retry logic
  - `notification_queue` - SMS/Email notification delivery system
  - `appointment_events` - Complete audit trail for all appointment changes
  - `doctor_schedules` & `doctor_breaks` - Advanced scheduling constraints
  - `queue_locks` - Distributed locking for concurrent queue operations
- **Production-grade optimizations**:
  - Strategic database indexes for performance
  - Automatic timestamp triggers
  - Row-level security policies
  - Data validation constraints

### 🔧 Technical Improvements
- **Fixed architecture issue**: Eliminated schema proliferation that was causing deployment conflicts
- **Performance optimizations**: Added indexes for queue operations, appointment lookups, and analytics
- **Error handling**: Comprehensive error handling in PostgreSQL functions with proper lock management
- **Scalability**: Designed for multiple clinics with proper user isolation and concurrent operations

Notes:
- **IMPORTANT**: Old migration files are safely backed up but should be replaced with the new consolidated schema
- The new schema is fully backward compatible with existing appointment data
- Some Supabase typing issues required explicit casts in a few update calls; these are noted in the code and can be refined by tightening the `Database` typings if desired.
- Enhanced queue management now supports real-time ETA calculations and automatic notifications

## [2025-09-05] Added/Fixed

### 🔧 Urgent Fixes (database & API)
- Fixed appointment status constraint and standardized status values to lowercase to prevent insertion errors (resolved "new row for relation 'appointments' violates check constraint 'appointments_status_check'").
- Added missing appointment columns required by queue management and ETA calculations: `patient_checked_in`, `checked_in_at`, `estimated_start_time`, `actual_start_time`, `actual_end_time`, `queue_position`, `expected_duration_minutes`.
- Created `job_queue` and `notification_queue` tables and added migrations to resolve PostgREST schema errors and enable background job processing.
- Consolidated and fixed several migrations to ensure schema cache consistency and added safe refactor migrations under `supabase/migrations/`.

### 🎨 UI / Calendar / Modal
- Redesigned calendar to a minimal, professional aesthetic with light orange/rose headers and subtle status-based colors for events.
- Reworked calendar `CustomToolbar` buttons (Today / Prev / Next / View toggles) to use the new orange-themed styles.
- Implemented status-based event classes and moved styling to `src/components/CalendarView.css`.
- Reworked `AppointmentDetailsModal`:
  - Removed emojis and simplified layout for a clean, professional look.
  - Moved Date & Time to the top-right of the modal in small text.
  - Added clear Patient and Doctor information sections (contact, email, age, gender, specialization, fees).
  - Replaced JSON medical-history display with plain text handling (accepts string or comma-separated arrays and renders as comma-separated text).
  - Added timing fields display: Checked-in time, Started, Ended, ETA.
  - Added derived timing analytics: Waiting Time, Consultation Duration, Schedule Variance, Total Time (scheduled→completion).
  - Improved action button flow: updates now refresh local modal state and keep the modal open for Completed appointments so you can see timing details.

### 🛠 Code / Types
- Aligned frontend enums/constants (`AppointmentStatus`) with database constraints and converted usage to enum constants to avoid mismatches.
- Fixed TypeScript mismatches in `AppointmentDetailsModal` and `CalendarView` by replacing string literals with `AppointmentStatus` enum values.
- Applied small type-safety improvements and replaced `any` usage with `unknown` or more specific types where possible.

### ✅ Notes & Follow-ups
- After these changes, test the appointment flow: create, check-in, start, complete — ensure `checked_in_at`, `actual_start_time`, and `actual_end_time` are persisted and shown in the modal.
- Next recommended steps: integrate quick billing from the Completed modal, enable real-time queue updates with Supabase subscriptions, and add small analytics (average wait/consult times) on the Dashboard.



## [2025-09-1] Added/Fixed
- Created a new `History` page to display recent activities and changes made within the dashboard.
- Fixed notification center position to ensure it appears correctly on the screen.
- Tested and verified patient, doctor, appointment, Billing, reports, history, settings functionalities to ensure they are working as expected.
- Implemented a `RecentActivities` component to display a list of recent activities in the dashboard.
- Updated the `Dashboard` layout to include the `RecentActivities` component for better user engagement.
- Added `overflow-y-auto` class to the `RecentActivities` component to enable scrolling when the content exceeds the maximum height.
- Created `EditPatientsModal` components and `ViewPatientModal` to add  `Edit/view` feature for patients.
- Created `EditPatientsModal` component to add `Edit` feature for doctors.
- Created `RescheduleAppointmentModal` component to add `Reschedule` feature for appointments.


## [2025-09-2] Added/Fixed

- Fixed dashboard metrics hook to correctly fetch today's appointments using proper date filtering.
- Fixed billing system database schema mismatch - corrected column names from `clinic_id` to `user_id` and removed non-existent `service_description` column.
- Implemented bill generation functionality with proper form validation and patient selection.
- Added working bill view and download features with HTML export functionality.
- Fixed History page - removed treatments tab and implemented working "View Details" modal for appointments and payments.
- Added export functionality to Reports page - generates professional HTML reports with all analytics data.
- Resolved multiple database schema cache errors by aligning code with actual database structure.
- Enhanced bill management with proper status tracking (pending, paid, overdue) and payment mode recording.
- Fixed the notification allignment issue in the notification center.
- Improved overall UI of `Notifications` panel for better user experience and responsiveness.
- Replaced the `Activity` icon with `ArrowLeftCircle` icon for better visual representation of "Go to homepage" action.
- Updated the UI of the `landing/home page` for a more modern, minimalist and appealing look.
- Updated the UI of the `Notification` for a cleaner and more user-friendly experience.

## [2025-09-3] Added/Fixed
- Separated the `Header/Navbar` component into `HeaderHome` from the `landing` page.
- Made the new  `HeaderHome` component responsive for better user experience on different devices.
- Added a `Hamburger menu` in the `HeaderHome` component for better navigation on smaller screens.
- Updated the `ActionButtons` component to Align better in different devices.
- Added horizontal scrollbar to the `Tabs` component in the `Settings` and `History` page for better navigation when there are many tabs or in small devices.



----------


# Vision for the project:

# So far this is what i have understood about the flow of the website:

- the user visits the landing page first and sees about the clinic admin application.
- if the user wants to use the application, they can sign in or sign up.
- after signing in, the user is redirected to the dashboard where they can see the statistics and manage patients, appointments, doctors etc.

# So far the functionalities that are working:

- Sign up and Sign in using supabase authentication.
- Viewing and managing patients, appointments, doctors, and prescriptions.
- Viewing statistics on the dashboard.
- Responsive design for better user experience on different devices.
- Collapsable sidebar for better navigation.
- Personalized user information display in the navbar after signing in.
- Complete billing system with generation, viewing, and downloading capabilities.
- Reports export functionality with professional HTML format.
- History tracking with detailed view modals for all activities.

# Next steps(Things which are not working yet):
- Email/appointment/payment notifications.
- Realtime updates using supabase subscriptions (partially working).
- Data export in CSV/Excel format for reports.

# Things to focus on right now:

- Implementing notification system.
- Adding CSV/Excel export options.
- Testing all functionalities for production readiness.

