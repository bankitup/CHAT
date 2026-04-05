# Messaging RTC

This folder defines the future call/session boundary for CHAT.

Planned responsibilities:

- Call session and participant contracts.
- Signaling event contracts and adapter interfaces.
- Separation between chat-thread message history and live RTC runtime.
- Future call runtime helpers that should not depend on route-level refresh.

Do not place actual media transport logic inside the thread history path.
