# DM E2EE Status Matrix

Status categories:

- Implemented
- Partially implemented
- Prepared / documented only
- Intentionally unsupported

Use this as a quick status snapshot.

Use [e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md) for the full security source of truth.

## Current matrix

| Area | Status | Notes |
| --- | --- | --- |
| Device registration | Implemented | Client generates and stores device private material locally and publishes public device material only. |
| Prekey publication | Implemented | Signed prekey and one-time prekey public material are published server-side. |
| Encrypted send | Implemented | DM text is encrypted client-side and stored as shell + ciphertext envelopes with no plaintext body. |
| Encrypted receive / decrypt | Implemented | DM text is decrypted client-side for thread rendering only. |
| Inbox preview cache | Implemented | Local-only, user-scoped, disposable decrypted preview cache for inbox rows. |
| Session hardening | Partially implemented | Bootstrap retries, stale-state recovery, and atomic send are in place; full ratcheted follow-up session state is not. |
| Failure / recovery UX | Implemented | Calm error states and supported recovery actions exist for current real failure cases. |
| Reply policy | Implemented | Replies to encrypted DMs use references plus generic encrypted reply labels. |
| Edit policy | Intentionally unsupported | Encrypted DM edit is blocked in v1. |
| Delete policy | Implemented | Sender-owned soft delete remains available for encrypted DMs. |
| Search policy | Implemented | Encrypted DM plaintext is not server-searchable; generic fallback text is not treated as searchable content. |
| Rollout guardrails | Implemented | Closed-user rollout gating and operator-safe documentation are in place. |
| Test coverage | Partially implemented | Focused boundary tests exist for shell payloads, preview behavior, and failure semantics; no full browser/integration harness yet. |
| Multi-device | Intentionally unsupported | v1 assumes one active device per user. |
| Groups | Intentionally unsupported | No group E2EE in current scope. |
| Attachments | Intentionally unsupported | No attachment E2EE in current scope. |

## Quick notes

- The current protocol is a prekey-bootstrap-style encrypted DM path, not full X3DH + Double Ratchet parity.
- Server-readable DM plaintext is not part of the encrypted DM path.
- Operational support must follow [e2ee-ops-playbook.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-ops-playbook.md).
