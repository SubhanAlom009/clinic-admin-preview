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
- Added a `Go back to Home` button in the header to allow users to easily navigate back to the landing page from any section of the application.
- Updated the `landing page` navbar so that after signing in, the user's information (such as name or clinic name) is displayed instead of the "Sign In" button, providing a personalized experience.
