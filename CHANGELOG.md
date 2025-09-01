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

# Next steps(Things which are not working yet):

- Implement the ability to edit patients, appointments, doctors, and prescriptions.
- Email/appointment/payment notifications.
- some part of `reports` section is not working.
- Realtime updates using supabase subscriptions (disabled for now).
- ability to download or view bills/invoices.
- abilty to export data in csv or excel format.
- ability to update patients and doctors details
- Recent activitt tab is not working.

# Things to focus on right now:

- making a working prototype of the application with all the functionalities.
