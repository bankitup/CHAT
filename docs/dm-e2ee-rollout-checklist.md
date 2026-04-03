# DM E2EE Rollout Checklist

This checklist is for controlled rollout of encrypted direct messages inside the closed-user CHAT product.

The goals are:

- enable encrypted DMs only for explicitly chosen testers
- keep the server blind to DM plaintext
- make debugging and rollout decisions possible without plaintext logging or operator bypasses

## Runtime rollout controls

Encrypted DM rollout is controlled by environment variables:

- `CHAT_DM_E2EE_ROLLOUT=disabled|selected|all`
- `CHAT_DM_E2EE_TESTER_USER_IDS=<comma-separated auth user ids>`

Recommended rollout order:

1. `disabled`
   Use while migrations or client bootstrap are still being validated.
2. `selected`
   Use for internal testers only.
3. `all`
   Use only after the selected-tester checklist is consistently green.

Notes:

- `selected` mode enables encrypted DMs only for the listed auth user ids.
- Non-enabled users do not bootstrap DM E2EE device state and cannot call encrypted DM bootstrap/send endpoints successfully.
- This is a rollout gate, not an operator recovery path. It does not reveal plaintext.

## Readiness checklist before enabling testers

All of these should be true before enabling even a small tester set:

- required DM E2EE migrations are applied
- `public.user_devices` exists
- `public.device_one_time_prekeys` exists
- `public.messages.content_mode` and `public.messages.sender_device_id` exist
- `public.message_e2ee_envelopes` exists
- browser support is acceptable for the tester devices
- first-contact encrypted DM send works
- repeat encrypted DM send works
- encrypted DM receive/decrypt works on the same device
- inbox fallback or local preview behavior is understood and accepted
- unsupported flows are documented for testers

## Tester acceptance checklist

For each selected tester pair, verify:

1. Both users can log in normally.
2. Both users are listed in `CHAT_DM_E2EE_TESTER_USER_IDS`.
3. Each user gets a `user_devices` row after opening the app.
4. Each user publishes one-time prekeys.
5. First encrypted DM send succeeds without plaintext fallback.
6. Recipient can decrypt and read the message in-thread.
7. Second send also succeeds after bootstrap.
8. Recovery paths work for stale sender setup or a prekey race.

## Unsupported or intentionally limited behavior

Testers should be told these limits clearly:

- one active device per user in v1
- no group E2EE
- no attachment E2EE
- no voice-note E2EE
- no server-side encrypted DM text search
- no encrypted DM edit flow yet
- replies keep the message reference but not an encrypted plaintext snippet
- local device loss may make older encrypted DMs unavailable on that device

## Honest debugging guidance

Allowed debugging checks:

- verify rollout env vars
- verify whether the user is in the tester allowlist
- verify `user_devices` row exists
- verify one-time prekeys exist or are exhausted
- verify encrypted message shell rows exist in `public.messages`
- verify ciphertext envelope rows exist in `public.message_e2ee_envelopes`
- verify the current device still has its local IndexedDB key material

Do not do any of the following:

- add plaintext logging
- add server-side preview/debug copies
- add operator decrypt endpoints
- store private keys in Supabase secrets or server actions

## Suggested limited-rollout decision

Encrypted DMs are ready for a small selected-tester rollout only when:

- the runtime rollout gate is in `selected`
- the migration checklist is green
- at least two tester pairs have completed first-contact and repeat-send checks successfully
- failure states are understandable and recoverable without raw technical text

If any of those fail, keep rollout at `disabled` or `selected`, not `all`.
