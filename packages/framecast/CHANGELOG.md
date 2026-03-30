# @ciolabs/framecast

## 0.2.0

### Minor Changes

- [#46](https://github.com/customerio/ciolabs/pull/46) [`aabf68d`](https://github.com/customerio/ciolabs/commit/aabf68d967423cb831da63ffd3f3dccf13622ac5) Thanks [@avigoldman](https://github.com/avigoldman)! - Add `queueMessages` option to `waitForReady()` and public `clearQueue()` method. When `queueMessages: true`, `broadcast()` calls are automatically queued until the handshake completes, then flushed. On timeout, queued messages are discarded.

## 0.1.0

### Minor Changes

- [#44](https://github.com/customerio/ciolabs/pull/44) [`9d76ad4`](https://github.com/customerio/ciolabs/commit/9d76ad47693e75b1ae9de8a1934e45a4cfa022fd) Thanks [@avigoldman](https://github.com/avigoldman)! - Add `signalReady()` and `waitForReady()` methods for built-in iframe ready handshake support. This removes the need for consumers to build their own ready handshake pattern when using srcdoc iframes.

## 0.0.1

### Patch Changes

- [#17](https://github.com/customerio/ciolabs/pull/17) [`311333f`](https://github.com/customerio/ciolabs/commit/311333f95cdb9912035fb00a01d6c70d9dcf234a) Thanks [@avigoldman](https://github.com/avigoldman)! - initial version
