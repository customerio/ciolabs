---
'@ciolabs/framecast': minor
---

Fix window `message` listener leak and add `destroy()` method. The constructor previously passed a fresh `this.handlePostedMessage.bind(this)` to both `removeEventListener` and `addEventListener`, so the removal never matched and every Framecast instance leaked its listener for the life of the page. A single bound handler is now kept on the instance, and the new `destroy()` method removes the listener, rejects pending `call()`s with a "Framecast destroyed" error (clearing their timeouts), clears broadcast listeners, discards queued broadcasts, and nulls the target window so a detached iframe can be garbage collected. After `destroy()`, `postMessage` becomes a no-op instead of posting to a stale window.
