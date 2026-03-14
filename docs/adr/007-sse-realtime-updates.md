# ADR 007: SSE Realtime Updates

- Status: accepted
- Date: 2026-03-14
- Deciders: project maintainers
- Supersedes: n/a
- Superseded by: n/a

## Context

The project outline defines a live updates channel for job state, sandbox activity, and workflow progress. M1 introduces the first realtime surface through an authenticated `GET /api/events` endpoint, but the system does not yet need websocket-level bidirectional behavior.

The repository also needs a concrete answer for how realtime updates fit with the new session-cookie auth model introduced in M1.

## Decision

Quayboard will use Server-Sent Events for realtime updates.

- The realtime endpoint is `GET /api/events`.
- Access is authenticated using the same session cookie used by the rest of the browser app.
- Connections are scoped to the authenticated user.
- The server sends an immediate `connected` event and periodic `heartbeat` events.
- The initial implementation is an in-process event hub suitable for the current single-node development/runtime model.

## Consequences

This keeps the realtime transport simple, works well with the browser-first product surface, and matches the existing planning documents without introducing websocket infrastructure early.

The tradeoff is that later multi-node deployments will need a fan-out mechanism behind the SSE endpoint if events must originate from more than one API process.
