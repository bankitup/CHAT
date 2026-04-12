# DM E2EE MVP Decision

This document makes a product-stage call on the current DM E2EE runtime.

Question:

- should the current strict encrypted-DM history model stay in the MVP critical path for a closed, monetizable private messenger

Short answer:

- not as the default daily-message path for MVP
- keep the E2EE architecture foundation
- de-scope or soften the current strict device-bound history behavior in the product path until continuity and recovery are strong enough for everyday trust

Use this alongside:

- [dm-e2ee-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-architecture.md)
- [e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)
- [e2ee-status-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-status-matrix.md)
- [mvp-security-posture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/mvp-security-posture.md)

## Current user-visible tradeoff

Today the encrypted DM path is honest but strict:

- DM text is encrypted client-side
- the server does not keep a readable plaintext fallback
- readable history depends on the current device having the right local private material and matching device identity context
- when that continuity breaks, older encrypted messages can render as unavailable on the current device

That behavior is visible in the current runtime and policy:

- [encrypted-dm-message-body.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-message-body.tsx)
- [ui-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/e2ee/ui-policy.ts)

The practical user-facing outcome is that a person can open a healthy DM thread and still see older encrypted messages represented as:

- unavailable on this device
- history unavailable on this device
- device-retired-or-mismatched
- same-user-new-device-history-gap
- policy-blocked history when product policy intentionally withholds that path

Security truth:

- this is consistent with a real server-blind model
- it avoids fake recovery promises

Product cost:

- users experience this as message loss, device breakage, or app unreliability even when the cryptographic behavior is technically truthful

## Product-stage evaluation

For a security prototype or limited technical beta, the current behavior is acceptable.

For a closed, monetizable messenger that users should trust for daily communication, the current behavior is too harsh to sit in the MVP critical path by default.

Why:

### User trust impact

Positive:

- strict behavior is honest
- the product is not lying about operator access or recovery

Negative:

- daily users do not evaluate this primarily as cryptographic honesty
- they evaluate it as “can I still read my messages when I come back tomorrow, reinstall, switch browser state, or move devices”
- if older messages disappear or become unreadable on the next device, trust in the product drops harder than trust rises from the invisible security property

Net product read:

- the current model is security-credible
- it is not yet trust-complete for a paid daily messenger

### Support burden

If strict device-bound history remains default in MVP, support burden will be high:

- users will report unreadable old messages as data loss
- support cannot actually recover the content
- many incidents will end with explanation rather than resolution
- “working as designed” will still feel like product failure to users

This is manageable in a tightly controlled tester cohort.
It is expensive in a monetized MVP.

### Daily-use friction

Current friction is not edge-case polish. It is core product friction:

- local storage loss can strand history
- device replacement can strand history
- browser reset or device retirement can strand history
- cross-device expectations are unmet by design

A daily messenger can survive missing advanced security UX for a while.
It struggles much more to survive unpredictable history continuity.

## Recommendation

Recommended call for the current MVP stage:

- do not keep the current strict device-bound encrypted DM history behavior in the main MVP product path
- keep the E2EE architecture foundation and continue hardening it
- treat current strict DM E2EE as a limited rollout mode, security preview, or gated product lane until continuity guarantees improve

Practical product stance:

- preserve the existing E2EE foundation work
- do not throw away the architecture
- do not promise the current encrypted DM path as the default daily-safe message mode yet

This is the product-reality choice, not a cryptography-purity choice.

## Practical next-step call

For the current Messenger MVP, make one concrete product decision and hold to it:

- keep the current strict DM E2EE path as an explicit gated lane
- do not make it the default trust promise for ordinary daily direct messages yet
- treat continuity and recovery as the release gate for promoting it into the main paid-user path

In practice that means:

- product, support, and rollout docs should describe the current strict path as limited and device-bound
- monetized daily-use messaging should not quietly inherit these history semantics by default
- promotion from gated lane to default lane should require continuity proof, not only crypto correctness

## What “soften or de-scope” should mean

For the current MVP, the safer product path is:

- keep the architecture and code foundation alive
- keep strict encrypted DMs behind explicit rollout gating
- avoid making the strict path the primary expectation for all paying/daily users
- keep product copy and support posture honest that current encrypted DM continuity is device-bound and limited
- revisit the default-path decision only after the team can demonstrate continuity behavior that feels boring and dependable in normal daily use

This does not require abandoning E2EE.
It means not making the current history semantics the default promise before continuity work exists.

## What must be built if strict E2EE stays in the MVP critical path

If the team decides to keep strict behavior as a first-class MVP promise anyway, then these are not optional polish items. They become core product scope:

1. Clear device lifecycle UX. Users must be able to understand which device owns readable history, and device replacement, retirement, and re-bootstrap semantics must be explicit.

2. Recovery and continuity story. The product needs either true multi-device continuity, a trustworthy device-transfer or recovery mechanism, or a sharply constrained single-device promise that users see before opting in.

3. User-facing expectation setting. Setup copy must explain what is lost when local device state is lost, and unavailable-history states must be understandable without internal diagnostics.

4. Support playbook and operator posture. Support needs a consistent answer that is honest and non-destructive, and operators need tooling to diagnose state without reading plaintext.

5. Rollout metrics. Track how often users hit `device-retired-or-mismatched`, `same-user-new-device-history-gap`, `local-device-record-missing`, and `missing-envelope`. If those rates are non-trivial, strict E2EE is not yet ready for the default product path.

6. Product-level continuity testing. This must cover real-world reinstall, browser reset, device migration, and stale local-state cases, not only crypto-correctness tests.

## Decision for the current stage

Recommended product decision now:

- preserve the strict DM E2EE foundation
- do not make current strict device-bound history behavior part of the MVP default trust promise
- treat it as a gated security track until continuity and recovery are materially better

In plain terms:

- good foundation
- not yet the right default for a daily paid messenger

## Explicit non-goals of this decision

This decision does not say:

- abandon E2EE
- add server-readable plaintext fallback
- weaken the long-term security target
- redesign the current DM architecture in this document

It only says:

- the current strict history behavior should not be mistaken for product-ready default MVP behavior
