# Chat Layout Regression Proof

## Conclusion

The current mobile chat surface break is a layout-contract regression caused by
`app/(app)/messenger-route.css`, not by missing data or a removed JSX shell.

The exact failure is an unclosed `.route-loading-inbox-time {` block at
[app/(app)/messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L1040).
Because modern CSS nesting is valid syntax, the browser does not throw a build
error. Instead, the chat surface selectors that follow are parsed as nested
descendants of `.route-loading-inbox-time`, so they no longer match the real
chat route.

This regression was introduced in the route-local CSS split commit
`3a627c0` (`perf/client-i18n-and-global-css-pass`), which moved the Messenger
surface layout contract out of `app/globals.css` and into
`app/(app)/messenger-route.css`.

## Intended Mobile Layout Contract

### Chat header

The healthy header contract is still present in JSX at:
- [thread-page-content.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-page-content.tsx#L237)

Expected structure:
- `.chat-header-stack`
- `.chat-header-card`
- `.chat-header-shell`
- `.chat-header-main-link`
- `.chat-header-copy`
- `.chat-header-meta`
- `.chat-header-avatar-slot`

Expected layout rules live in:
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L1042)

Those rules are supposed to provide:
- full-width header card
- 3-column grid shell
- centered main text block
- right-aligned avatar slot
- stable title/subtitle/status alignment

### Message row

The healthy message row contract is still present in JSX at:
- [thread-message-row.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-message-row.tsx#L1192)

Expected structure:
- `.message-row`
- `.message-card`
- `.message-bubble-shell`
- `.message-bubble`
- `.message-inline-content`
- `.message-meta`
- `.message-status`

Expected layout rules live in:
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L1626)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L1665)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L1776)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L2112)

Those rules are supposed to provide:
- left/right row alignment
- constrained card width
- bubble sizing
- inline timestamp/checkmark grouping
- non-stacking meta/status placement

### Voice message row

Voice rows still render through the normal row shell and expect:
- `.message-voice-card`
- `.message-voice-play`
- `.message-voice-copy`
- `.message-voice-duration`

Expected layout rules live in:
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L2313)

Those rules are supposed to provide:
- 2-column card layout
- fixed play button slot
- stable copy/meta column
- non-collapsing voice row height

### Composer

The healthy composer shell is still present in JSX at:
- [thread-composer-runtime.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx#L166)
- [plaintext-chat-composer-form.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx#L377)
- [encrypted-dm-composer-form.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx#L1377)

Expected structure:
- `.composer-card`
- `.composer-runtime-shell`
- `.composer-form`
- `.composer-input-shell`
- `.composer-input-field`
- `.composer-typing-shell`
- `.composer-action-cluster`
- `.attachment-entry-details`
- `.attachment-native-input`

Expected layout rules live in:
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L2998)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L3130)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L3190)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L3288)
- [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L3484)

Those rules are supposed to provide:
- rounded composer shell grid
- textarea center column
- stable action cluster
- hidden native file input
- attachment trigger/menu instead of browser default file control

## What Is Actually Broken

### The exact structural regression

At [messenger-route.css](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/messenger-route.css#L1040)
the file contains:

```css
.route-loading-inbox-time {

.chat-header-stack {
```

That outer block never closes before the chat surface selectors continue.

An `awk` brace-depth check confirms the file leaves depth `0` at line `1039`,
enters depth `1` at line `1040`, and all the major chat selectors then sit at
depth `2`, meaning they are nested under `.route-loading-inbox-time` instead of
remaining top-level rules.

## Why This Breaks The Chat Surface

Because the chat route does not render inside `.route-loading-inbox-time`, the
following selectors no longer match their intended elements:
- `.chat-header-stack`
- `.chat-header-card`
- `.chat-header-shell`
- `.chat-main`
- `.message-thread`
- `.message-row`
- `.message-card`
- `.message-bubble-shell`
- `.message-status`
- `.message-voice-card`
- `.composer-card`
- `.composer-form`
- `.composer-input-shell`
- `.composer-action-cluster`
- `.attachment-native-input`

That maps directly to the observed symptoms:
- oversized, misaligned header card: chat header grid/flex rules are not active
- misplaced participant avatar: avatar slot alignment rules are not active
- broken message row structure: row/card/bubble sizing rules are not active
- stacked timestamps/checkmarks/text/voice rows: inline meta/status rules are not active
- composer shell collapse: composer grid/sizing rules are not active
- raw browser file input visible: `.attachment-native-input { display: none; }`
  is not active

## Why This Is Not A JSX Composition Bug

The inspected route files still preserve the intended structural wrappers:
- [thread-page-content.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-page-content.tsx#L237)
- [thread-message-row.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-message-row.tsx#L1192)
- [thread-composer-runtime.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx#L166)
- [plaintext-chat-composer-form.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx#L377)
- [encrypted-dm-composer-form.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx#L1377)

I did not find a corresponding loss of header/message/composer wrappers in JSX.
The strongest failure path is the CSS selector scope regression above.

## Why The Build Still Passed

This does not fail `lint`, `typecheck`, or `build` because the stylesheet is
still parseable. The browser/tooling can treat the later rules as valid nested
CSS instead of flagging a syntax error. The result is a selector-scope bug, not
a compile-time failure.

## Targeted Next Fix

The next branch should stay narrow:
- close or remove the stray `.route-loading-inbox-time` block
- restore chat surface selectors to top-level scope
- add a lightweight guard so top-level chat selectors cannot silently become
  nested under inbox-loading selectors again
