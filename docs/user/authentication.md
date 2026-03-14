# Authentication

Quayboard M1 includes a minimal local authentication flow.

## Register

1. Open `http://localhost:3000/register`
2. Enter a display name, email address, and password
3. Submit the form

The API creates a local user record and sets a session cookie in the browser.

## Sign In

1. Open `http://localhost:3000/login`
2. Enter the email address and password you registered with
3. Submit the form

Successful sign-in redirects to the protected placeholder page for the authenticated API shell.

## Sign Out

Use the `Sign out` button on the protected page. This clears the session cookie and revokes the stored session on the server.

## Notes

- M1 supports only local email/password accounts
- OAuth, RBAC, and API keys are not available yet
- the current protected page is intentionally minimal; later milestones add the rest of the product UI
