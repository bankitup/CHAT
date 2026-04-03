# DM E2EE Ops Playbook

Purpose:

- give operators and support a short, usable playbook for DM E2EE rollout and incident handling
- keep rollout, support, and debugging inside the current security model
- avoid ad hoc support behavior that would weaken server blindness

Use this together with:

- [e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)
- [dm-e2ee-rollout-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-rollout-checklist.md)

## 1. Scope

This playbook applies to:

- direct-message E2EE rollout
- tester support during encrypted DM issues
- operator/debug decisions during incidents

This playbook does not authorize:

- plaintext access requests
- server-side decryption
- support-side key recovery
- hidden feature bypasses

## 2. What Operators Can Verify

Operators may verify:

- whether DM E2EE rollout is enabled for a user account
- whether the required E2EE schema migrations are present
- whether the user has a current `user_devices` row
- whether one-time prekeys exist for the active device
- whether encrypted DM shell rows are being created
- whether ciphertext envelope rows are being created
- whether expected API routes are returning rollout/schema/readiness errors
- whether conversation/message ordering metadata looks correct
- whether a message was soft-deleted

Operators may inspect only server-visible metadata such as:

- user id
- conversation id
- device record id
- message id
- timestamps
- `content_mode`
- `sender_device_id`
- envelope presence/count/type
- prekey claim state

## 3. What Operators Cannot Verify

Operators must not attempt to verify:

- plaintext DM body content
- decrypted inbox preview text
- private identity keys
- private signed prekeys
- private one-time prekeys
- decrypted local preview cache contents
- client-local decrypted thread bodies

Operators also cannot determine from the server alone:

- whether a specific encrypted message rendered correctly on the device
- whether a user still has the private material needed to decrypt an older encrypted message
- what a user actually typed in an encrypted DM

## 4. Allowed Troubleshooting Workflow

Use this order:

1. Confirm the user is in the intended rollout group.
2. Confirm required E2EE migrations are present.
3. Confirm the user has an active `user_devices` row.
4. Confirm prekeys are available or already claimed as expected.
5. Confirm `public.messages` row exists with `content_mode = 'dm_e2ee_v1'` and `body = null`.
6. Confirm `public.message_e2ee_envelopes` rows exist for the expected recipient device ids.
7. Ask the user to use only supported in-product recovery steps.

If the issue is “cannot send encrypted DM”:

- verify rollout enablement
- verify sender device row exists and is not retired
- verify recipient device row exists
- verify one-time prekey availability or recent prekey conflict behavior
- ask the user to retry, refresh encrypted setup, or reload chat

If the issue is “cannot read encrypted DM on this device”:

- verify message shell and envelope presence
- verify the user is on the same device/browser profile expected for that encrypted state
- ask the user to retry, refresh encrypted setup, or reload chat
- if the user lost local key state, explain that old encrypted messages may not be recoverable in v1

## 5. Allowed Logs and Metrics

Allowed:

- route success/failure counts
- rollout-disabled counts
- schema-missing counts
- device-registration success/failure counts
- recipient-device-missing counts
- prekey-conflict counts
- decrypt-unavailable state counts when based on generic error classes only
- message/envelope row presence counts

Allowed log content must stay metadata-only:

- ids
- timestamps
- error codes
- generic failure category

Not allowed:

- plaintext message content
- decrypted previews
- serialized private keys
- copied ciphertext plus derived plaintext
- “temporary” support logs containing DM text

## 6. Acceptable User-Facing Recovery Steps

Support may ask users to:

- retry the send
- retry opening the message
- reload the chat
- refresh encrypted setup
- log out and log back in on the same device if the product flow already supports it
- confirm they are using the intended browser/device profile

Support may explain:

- encrypted DMs are limited to supported rollout users
- encrypted messages may be unavailable on a device that does not have the needed local key material
- old encrypted messages may be unrecoverable after true local key loss in v1

## 7. Requests That Must Be Refused

Refuse any request to:

- read a user’s encrypted DM text from the server
- add temporary plaintext logging for debugging
- copy decrypted previews into database fields
- export private device key material from the browser into server tools
- create an admin/support decrypt endpoint
- bypass rollout by downgrading encrypted DM sends to plaintext
- ask users to send screenshots of sensitive plaintext content unless strictly necessary for product support and explicitly user-chosen

The correct answer is that the current security model does not permit those actions.

## 8. Incident Notes Template

For internal incidents, record:

- affected user ids
- affected conversation ids
- whether rollout was enabled
- whether schema was complete
- whether active device rows existed
- whether envelope rows existed
- whether the failure was send, decrypt, preview, or recovery related
- which allowed recovery steps were tried
- whether the issue appears to be local-key loss, rollout config, schema drift, or send-path failure

Do not record:

- plaintext DM text
- decrypted previews
- private keys

## 9. Escalation Rule

Escalate to engineering when:

- schema drift is suspected
- the atomic encrypted send function is missing or failing
- envelope rows are absent despite successful client send attempts
- local-state cleanup appears to be incorrect across logout/account switch
- rollout configuration is inconsistent with expected tester access

## 10. Operator Checklist

Before saying “working as designed,” confirm:

- rollout status is correct
- schema is current
- server metadata is internally consistent
- user has been given all supported recovery steps
- the requested support action does not violate [e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)
