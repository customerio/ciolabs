---
'@ciolabs/framecast': minor
---

Add `queueMessages` option to `waitForReady()` and public `clearQueue()` method. When `queueMessages: true`, `broadcast()` calls are automatically queued until the handshake completes, then flushed. On timeout, queued messages are discarded.
