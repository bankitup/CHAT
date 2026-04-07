# KeepCozy Role Layering

## Purpose

This document defines the role layers that KeepCozy should use as space
architecture evolves beyond the current CHAT runtime.

The goal is to keep operational meaning, moderation meaning, and platform-level
meaning separate so later schema and policy work can stay additive and
reviewable.

Related documents:

- [keepcozy-chat-role-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-role-alignment.md)
- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [security/e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)

## 1. Global Platform Roles

Global platform roles live above any one space.

Examples:

- `authenticated_user`
- `platform_admin`
- `support_staff`

Their purpose is platform-level identity, environment support, and operational
tooling. They should not automatically grant space visibility.

Design rule:

- global platform role is not a substitute for `space_members`

## 2. Space Roles

Space roles are the main KeepCozy operational roles inside one managed
property, home, or operational object.

Recommended target space roles:

- `owner`
- `resident`
- `operator`
- `internal_staff`
- `contractor`
- `supplier`
- `inspector`

These roles answer operational questions such as:

- who is responsible for oversight
- who is client-facing
- who is temporary and assignment-scoped
- who may see internal-only work

Design rule:

- operational meaning belongs at the space layer first

## 3. Thread Participation and Moderation Roles

Thread participation and moderation roles belong to one specific conversation.

Current runtime examples:

- `owner`
- `admin`
- `member`

These roles answer narrower questions such as:

- who moderates a group thread
- who may rename a group
- who may add or remove participants
- who is an active participant in this one thread

They do not carry full operational job meaning.

Design rule:

- thread participation and moderation roles stay generic and subordinate to the
  space role layer

## 4. Why These Layers Must Stay Separate

The layers solve different problems.

Global platform roles answer:

- who is this person in the platform

Space roles answer:

- what is this person's operational role in this managed space

Thread participation and moderation roles answer:

- what authority or membership does this person have inside this specific
  thread

If these layers are collapsed too early:

- operational roles leak into generic moderation fields
- policy decisions become hard to audit
- external participants may accidentally inherit too much visibility
- future RLS work becomes brittle
- private-message trust boundaries become easier to misread

## 5. What Current Code Already Supports

The current repository already has the outer shape, but not the full KeepCozy
role model.

Current active primitives:

- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
  defines `SpaceRole = 'owner' | 'admin' | 'member'`
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)
  defines `GroupConversationMemberRole = 'owner' | 'admin' | 'member'`
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
  already treats `space_members` as the outer boundary
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
  documents that `public.conversation_members.role` is active runtime state

Current limitation:

- the same small generic role vocabulary is still doing double duty across
  spaces and conversations

## 6. Likely Future Mapping and Compatibility Layer

The preferred next step is not to overload current conversation role fields
with operational role semantics.

Instead, KeepCozy will likely need a mapping and compatibility layer that says:

- what space role a person has in this space
- what default audience access that role implies
- what thread participation role they should receive when added to a thread
- what assignment limits or invitation rules apply

That mapping layer may live in:

- additive schema
- backend policy helpers
- shared TypeScript contracts

Current branch note:

- the first shared TypeScript draft now lives in
  [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
  and [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

The important rule is architectural, not physical:

- operational meaning should not be forced into `conversation_members.role`

## 7. Guardrails

Keep these guardrails explicit in later work:

- do not overload `public.conversations.kind` beyond `dm` and `group`
- do not write `contractor`, `supplier`, `operator`, or `resident` directly
  into current conversation moderation fields unless the role model is formally
  redesigned
- do not treat `platform_admin` or `support_staff` as implicit space members
- do not treat space ownership or operator oversight as DM decryption authority
- do not assume thread participation roles can carry operational assignment
  semantics by themselves
- do not couple internal-only access to client-side hiding alone

## 8. Current State vs Target State

| Layer | Current state | Target state |
| --- | --- | --- |
| Global platform role | minimal and mostly implicit | explicit but still rare and non-bypassing |
| Space role | generic `owner/admin/member` | operational roles with assignment and visibility meaning |
| Thread participation/moderation role | generic `owner/admin/member` | still generic, still thread-local |
| Mapping between layers | mostly implicit | explicit compatibility and policy layer |

## 9. Working Guidance

When a future implementation question asks “what role is this user?”, answer in
this order:

1. what global platform role do they have
2. what space role do they have in this space
3. what thread participation or moderation role do they have in this
   conversation

If a proposal cannot keep those answers separate, it is probably mixing layers
too early.
