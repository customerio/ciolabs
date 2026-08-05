# @ciolabs/framecast

## 0.3.0

### Minor Changes

- [#64](https://github.com/customerio/ciolabs/pull/64) [`3e68e91`](https://github.com/customerio/ciolabs/commit/3e68e91c1ab0f574cb8106c301dc42b9a0b48a27) Thanks [@yashschandra](https://github.com/yashschandra)! - Fix window `message` listener leak and add `destroy()` method. The constructor previously passed a fresh `this.handlePostedMessage.bind(this)` to both `removeEventListener` and `addEventListener`, so the removal never matched and every Framecast instance leaked its listener for the life of the page. A single bound handler is now kept on the instance, and the new `destroy()` method removes the listener, rejects pending `call()`s with a "Framecast destroyed" error (clearing their timeouts), clears broadcast listeners, discards queued broadcasts, and nulls the target window so a detached iframe can be garbage collected. After `destroy()`, `postMessage` becomes a no-op instead of posting to a stale window.

## 0.2.0

### Minor Changes

- [#46](https://github.com/customerio/ciolabs/pull/46) [`aabf68d`](https://github.com/customerio/ciolabs/commit/aabf68d967423cb831da63ffd3f3dccf13622ac5) Thanks [@avigoldman](https://github.com/avigoldman)! - Add `queueMessages` option to `waitForReady()` and public `clearQueue()` method. When `queueMessages: true`, `broadcast()` calls are automatically queued until the handshake completes, then flushed. On timeout, queued messages are discarded.

## 0.1.0

### Minor Changes

- [#44](https://github.com/customerio/ciolabs/pull/44) [`9d76ad4`](https://github.com/customerio/ciolabs/commit/9d76ad47693e75b1ae9de8a1934e45a4cfa022fd) Thanks [@avigoldman](https://github.com/avigoldman)! - Add `signalReady()` and `waitForReady()` methods for built-in iframe ready handshake support. This removes the need for consumers to build their own ready handshake pattern when using srcdoc iframes.

## 0.0.1

### Patch Changes

- [#17](https://github.com/customerio/ciolabs/pull/17) [`311333f`](https://github.com/customerio/ciolabs/commit/311333f95cdb9912035fb00a01d6c70d9dcf234a) Thanks [@avigoldman](https://github.com/avigoldman)! - initial version
