# Messaging Realtime

This folder now contains the current Messenger realtime runtime.

The repo uses a practical hybrid contract:
- server reads stay authoritative
- Broadcast is used for low-latency committed-message hints and typing
- Presence stays separate
- Postgres Changes still acts as authoritative patch feed and recovery backstop

Current source-of-truth docs:
- `docs/realtime-current-contract.md`
- `docs/realtime-gap-report.md`
- `docs/realtime-broadcast-alignment-plan.md`

The intended direction is not "broadcast replaces authority".
The intended direction is:
- authoritative server/database state
- broadcast-first hot-path hints where they fit
- explicit catch-up and reconnect recovery
- auxiliary presence kept separate from message truth
