# changelog

# All notable changes to this project will be documented in this file.

## [2025-08-31] Added/Fixed

- Installed or updated `lucide-react` to ensure the `Users` icon is available and fix the "Users is not defined" error in Patients page.
- created a `LandingPage` component to serve as the main entry point for users visiting the application.
- Updated routing to direct users to the `LandingPage` by default.
- Added company logo to the landing page in the `navbar` and `footer` for branding.
- Added a collapsable feature in the sidebar for better navigation.
- Fixed the issue where the clinic name was not getting updated in the supabase database.
- Added Company logo in the header of the `layout` component for consistent branding across all pages.
- Fixed the collapsable sidebar to ensure it works correctly on all screen sizes.
- Added a `Go back to Home` button in the header of the dashboard to allow users to easily navigate back to the landing page.
- Updated the `landing page` navbar so that after signing in, the user's information (such as name or clinic name) is displayed instead of the "Sign In" button, providing a personalized experience.


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
- Fixeed the notification allignment issue in the notification center.
- Improved overall UI of `Notifications` panel for better user experience and responsiveness.


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