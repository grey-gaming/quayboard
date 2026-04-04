# First Install

Use this guide when the readiness checks on `/login` or `/register` are not all green.

## Required Setup

1. Install the local prerequisites from the repo `README.md`:
   - Node.js 20.x
   - pnpm 9 or newer
   - Docker and Docker Compose
2. Copy `.env.example` to `.env`.
3. Start Postgres with `docker compose up -d`.
4. Run `pnpm db:migrate`.
5. Start the app with `pnpm dev`.

## Fixing Failed Readiness Checks

### Database

- Check `DATABASE_URL` in `.env`.
- Make sure Postgres is running and reachable.
- Re-run migrations if the database was reset.

### Encryption Key

- Set `SECRETS_ENCRYPTION_KEY` in `.env`.
- The value must decode to 32 bytes, as described in the `README.md`.
- Restart the API after adding or changing the key.

### Docker

- Make sure Docker Desktop or the Docker daemon is running.
- Confirm `docker version` works from your shell.
- If you use a custom daemon, verify `DOCKER_HOST`.
- The first sandbox verification may pull `alpine:3.20` before running the startup check.

### Artifact Storage

- Check `ARTIFACT_STORAGE_PATH` in `.env`.
- Make sure the directory is writable by the API process. The API recreates it if `/tmp` cleanup removes it.

### Provider Adapters

- Review the provider-related environment variables in `.env.example`.
- Keep at least one supported provider path configured for the current instance.

## What To Do Next

- Reload `/login` or `/register` after fixing a blocker.
- If the page still shows a failure, check the API logs for the failing dependency.
