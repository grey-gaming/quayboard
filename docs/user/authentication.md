# Authentication

Quayboard currently supports local email/password authentication.

Before registering or signing in, the instance readiness checks must all pass. If any check is failing, start with the [First Install](/docs/first-install) guide.

## Register

1. Open `http://localhost:3000/register`
2. Confirm every instance readiness check is green
3. Enter a display name, email address, and password
4. Submit the form

The API creates a local user record and sets a session cookie in the browser.

## Sign In

1. Open `http://localhost:3000/login`
2. Confirm every instance readiness check is green
3. Enter the email address and password you registered with
4. Submit the form

Successful sign-in redirects to the protected placeholder page for the authenticated API shell.

## Sign Out

Use the `Sign out` button on the protected page. This clears the session cookie and revokes the stored session on the server.

## Notes

- Quayboard currently supports only local email/password accounts
- OAuth, RBAC, and API keys are not available yet
- the current protected page is intentionally minimal while the rest of the product UI is still being built
