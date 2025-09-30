import superjson from 'superjson';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Framecast } from './index';

// Mock window interfaces
interface MockWindow {
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

describe('Framecast', () => {
  let mockTargetWindow: MockWindow;
  let mockSelfWindow: MockWindow;
  let framecast: Framecast;
  let messageHandlers: Map<string, Function>;

  // Helper to simulate receiving a message
  const simulateMessage = (type: string, data: any, origin = 'https://example.com', channel = '__framecast') => {
    const messageHandler = messageHandlers.get('message');
    if (messageHandler) {
      const event = {
        data: superjson.stringify({ ...data, type, channel }),
        origin,
        source: mockTargetWindow,
      };
      messageHandler(event);
    }
  };

  beforeEach(() => {
    messageHandlers = new Map();

    // Mock target window (the frame we're communicating with)
    mockTargetWindow = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
    };

    // Mock self window (our current frame)
    mockSelfWindow = {
      postMessage: vi.fn(),
      addEventListener: vi.fn((type: string, handler: Function) => {
        messageHandlers.set(type, handler);
      }),
      removeEventListener: vi.fn(),
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
    };

    // Mock global window for timeout functions
    vi.stubGlobal('window', mockSelfWindow);

    framecast = new Framecast(mockTargetWindow as any, {
      self: mockSelfWindow as any,
      origin: 'https://example.com',
      functionTimeoutMs: 1000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('construction', () => {
    it('should throw error when no target window provided', () => {
      expect(() => new Framecast(null as any)).toThrow('Framecast must be initialized with a window object');
    });

    it('should set up message listener on self window', () => {
      expect(mockSelfWindow.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should remove existing message listener before adding new one', () => {
      expect(mockSelfWindow.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('messages', () => {
    it('parent-> child: broadcast and receive messages', () => {
      const testData = { hello: 'world', count: 42 };
      let receivedData: any;

      // Set up listener
      framecast.on('broadcast', (data: any) => {
        receivedData = data;
      });

      // Simulate receiving a broadcast message
      simulateMessage('broadcast', { data: testData });

      expect(receivedData).toEqual(testData);
    });

    it('child -> parent: broadcast and receive messages', () => {
      const testData = { message: 'from child', timestamp: Date.now() };

      // Send broadcast
      framecast.broadcast(testData);

      // Verify message was sent to target window (object property order may vary)
      expect(mockTargetWindow.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('"type":"broadcast"'),
        'https://example.com'
      );

      // More specific verification
      const call = mockTargetWindow.postMessage.mock.calls[0];
      const parsedMessage = superjson.parse(call[0]) as any;
      expect(parsedMessage.type).toBe('broadcast');
      expect(parsedMessage.channel).toBe('__framecast');
      expect(parsedMessage.data).toEqual(testData);
    });

    it('broadcast and receive messages supports multiple listeners', () => {
      const testData = { test: 'multiple listeners' };
      const receivedData: any[] = [];

      // Set up multiple listeners
      framecast.on('broadcast', (data: any) => {
        receivedData.push({ listener: 1, data });
      });

      framecast.on('broadcast', (data: any) => {
        receivedData.push({ listener: 2, data });
      });

      // Simulate receiving a broadcast message
      simulateMessage('broadcast', { data: testData });

      expect(receivedData).toHaveLength(2);
      expect(receivedData[0]).toEqual({ listener: 1, data: testData });
      expect(receivedData[1]).toEqual({ listener: 2, data: testData });
    });

    it('can turn off listeners', () => {
      const testData = { test: 'turn off listener' };
      let receivedCount = 0;

      const listener = () => {
        receivedCount++;
      };

      // Add listener
      framecast.on('broadcast', listener);

      // Simulate message
      simulateMessage('broadcast', { data: testData });
      expect(receivedCount).toBe(1);

      // Remove listener
      framecast.off('broadcast', listener);

      // Simulate another message
      simulateMessage('broadcast', { data: testData });
      expect(receivedCount).toBe(1); // Should not increase
    });
  });

  describe('security', () => {
    it('prevents messages being received from the wrong origin', () => {
      let receivedData: any;

      framecast.on('broadcast', (data: any) => {
        receivedData = data;
      });

      // Simulate message from wrong origin
      simulateMessage('broadcast', { data: { test: 'wrong origin' } }, 'https://malicious.com');

      expect(receivedData).toBeUndefined();
    });

    it('prevents messages being received from the wrong channel', () => {
      let receivedData: any;

      framecast.on('broadcast', (data: any) => {
        receivedData = data;
      });

      // Simulate message with wrong channel
      simulateMessage('broadcast', { data: { test: 'wrong channel' } }, 'https://example.com', '__different_channel');

      expect(receivedData).toBeUndefined();
    });

    it('allows wildcard origin', () => {
      // Create framecast with wildcard origin
      const wildcardFramecast = new Framecast(mockTargetWindow as any, {
        self: mockSelfWindow as any,
        origin: '*',
      });

      let receivedData: any;
      wildcardFramecast.on('broadcast', (data: any) => {
        receivedData = data;
      });

      const testData = { test: 'wildcard origin' };

      // Simulate message from any origin
      simulateMessage('broadcast', { data: testData }, 'https://any-origin.com');

      expect(receivedData).toEqual(testData);
    });
  });

  describe('functions', () => {
    it('parent-> child: call a function', async () => {
      const testResult = 'function result';

      // Set up function handler
      framecast.on('function:testFunction', async () => {
        return testResult;
      });

      // Start the function call
      const functionCallPromise = framecast.call('testFunction');

      // Get the call ID from the sent message
      const call = mockTargetWindow.postMessage.mock.calls[0];
      const sentMessage = superjson.parse(call[0]) as any;
      const callId = sentMessage.id;

      // Simulate the function result being received
      simulateMessage('functionResult', { id: callId, result: testResult });

      // Wait for the result
      const result = await functionCallPromise;
      expect(result).toBe(testResult);
    });

    it('parent-> child: call a function with arguments', async () => {
      const testArgs = ['arg1', { key: 'value' }, 42];

      // Call function with arguments
      framecast.call('testWithArgs', ...testArgs);

      // Verify the message was sent with correct arguments
      const call = mockTargetWindow.postMessage.mock.calls[0];
      const parsedMessage = superjson.parse(call[0]) as any;

      expect(parsedMessage.type).toBe('function:testWithArgs');
      expect(parsedMessage.channel).toBe('__framecast');
      expect(parsedMessage.args).toEqual(testArgs);
      expect(parsedMessage.id).toBeDefined();
    });

    it('only supports one function handler', () => {
      // Add first handler
      framecast.on('function:singleHandler', async () => 'first');

      // Adding second handler should throw
      expect(() => {
        framecast.on('function:singleHandler', async () => 'second');
      }).toThrow('Listener already exists for function:singleHandler');
    });

    it('can turn off function handler', () => {
      const handler = async () => 'test';

      // Add handler
      framecast.on('function:removable', handler);

      // Remove handler
      framecast.off('function:removable', handler);

      // Adding same function name should now work
      expect(() => {
        framecast.on('function:removable', async () => 'new handler');
      }).not.toThrow();
    });

    it('times out after configured timeout', async () => {
      const timeoutMs = 100;
      const shortTimeoutFramecast = new Framecast(mockTargetWindow as any, {
        self: mockSelfWindow as any,
        functionTimeoutMs: timeoutMs,
      });

      // Call function that will timeout
      const callPromise = shortTimeoutFramecast.call('nonExistentFunction');

      // Wait for timeout
      await expect(callPromise).rejects.toThrow('nonExistentFunction timed out after 100ms');
    });

    it('handles function call errors', async () => {
      const errorMessage = 'Function failed';

      // Start the function call
      const callPromise = framecast.call('errorFunction');

      // Get the call ID from the sent message
      const call = mockTargetWindow.postMessage.mock.calls[0];
      const sentMessage = superjson.parse(call[0]) as any;
      const callId = sentMessage.id;

      // Simulate error response
      simulateMessage('functionResult', {
        id: callId,
        error: new Error(errorMessage),
      });

      await expect(callPromise).rejects.toThrow(errorMessage);
    });

    it('waitFor does not timeout', async () => {
      const { result, dispose } = framecast.waitFor('slowFunction');

      // Get the call ID from the sent message
      const call = mockTargetWindow.postMessage.mock.calls[0];
      const sentMessage = superjson.parse(call[0]) as any;
      const callId = sentMessage.id;

      // Simulate delayed response
      setTimeout(() => {
        simulateMessage('functionResult', {
          id: callId,
          result: 'delayed result',
        });
      }, 10);

      const response = await result;
      expect(response).toBe('delayed result');

      dispose(); // Clean up
    });
  });

  describe('evaluate function', () => {
    it('evaluates function in target context when supported', async () => {
      // Create new mock windows for this test to avoid conflicts
      const newMessageHandlers = new Map();
      const newMockTargetWindow = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
      };

      const newMockSelfWindow = {
        postMessage: vi.fn(),
        addEventListener: vi.fn((type: string, handler: Function) => {
          newMessageHandlers.set(type, handler);
        }),
        removeEventListener: vi.fn(),
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
      };

      // Create framecast with evaluate support
      const evaluateFramecast = new Framecast(newMockTargetWindow as any, {
        self: newMockSelfWindow as any,
        supportEvaluate: true,
      });

      const testFunction = () => 'evaluated result';

      const callPromise = evaluateFramecast.evaluate(testFunction);

      // Get the call ID from the sent message
      const call = newMockTargetWindow.postMessage.mock.calls[0];
      const sentMessage = superjson.parse(call[0]) as any;
      const callId = sentMessage.id;

      // Simulate the evaluate call result
      const messageHandler = newMessageHandlers.get('message');
      if (messageHandler) {
        const event = {
          data: superjson.stringify({
            type: 'functionResult',
            channel: '__framecast',
            id: callId,
            result: 'evaluated result',
          }),
          origin: '*',
        };
        messageHandler(event);
      }

      const result = await callPromise;
      expect(result).toBe('evaluated result');
    });

    it('evaluates function with arguments', async () => {
      const testFunction = (a: number, b: number) => a + b;

      framecast.evaluate(testFunction, 5, 3);

      // Verify the call was made with serialized function and arguments
      expect(mockTargetWindow.postMessage).toHaveBeenCalledWith(
        expect.stringContaining('function:evaluate'),
        'https://example.com'
      );
    });
  });

  describe('channels', () => {
    it('uses custom channel when provided', () => {
      const customFramecast = new Framecast(mockTargetWindow as any, {
        self: mockSelfWindow as any,
        channel: 'custom',
      });

      customFramecast.broadcast({ test: 'custom channel' });

      // Verify the message was sent with custom channel
      const calls = mockTargetWindow.postMessage.mock.calls;
      const lastCall = calls.at(-1)!;
      const parsedMessage = superjson.parse(lastCall[0]) as any;

      expect(parsedMessage.type).toBe('broadcast');
      expect(parsedMessage.channel).toBe('__framecast_custom');
      expect(parsedMessage.data).toEqual({ test: 'custom channel' });
      expect(lastCall[1]).toBe('*'); // origin
    });

    it('filters messages by channel', () => {
      let receivedData: any;

      framecast.on('broadcast', (data: any) => {
        receivedData = data;
      });

      // Message with different channel should be ignored
      simulateMessage('broadcast', { data: { test: 'different channel' } }, 'https://example.com', '__framecast_other');

      expect(receivedData).toBeUndefined();

      // Message with correct channel should be received
      simulateMessage('broadcast', { data: { test: 'correct channel' } }, 'https://example.com', '__framecast');

      expect(receivedData).toEqual({ test: 'correct channel' });
    });
  });

  describe('error handling', () => {
    it('handles malformed messages gracefully', () => {
      const messageHandler = messageHandlers.get('message');

      // Should not throw on malformed JSON
      expect(() => {
        messageHandler?.({ data: 'invalid json', origin: 'https://example.com' });
      }).not.toThrow();

      // Should not throw on missing properties
      expect(() => {
        messageHandler?.({ data: '{}', origin: 'https://example.com' });
      }).not.toThrow();
    });

    it('handles missing function handlers', () => {
      // Simulate call to non-existent function
      simulateMessage('function:nonExistent', { id: 'test-id', args: [] });

      // Should send error response - verify the last call
      const calls = mockTargetWindow.postMessage.mock.calls;
      const lastCall = calls.at(-1)!;
      const parsedMessage = superjson.parse(lastCall[0]) as any;

      expect(parsedMessage.type).toBe('functionResult');
      expect(parsedMessage.channel).toBe('__framecast');
      expect(parsedMessage.id).toBe('test-id');
      expect(parsedMessage.error.message).toBe('No listeners for function:nonExistent');
    });
  });

  describe('state management', () => {
    it('creates state atoms with initial values', () => {
      const initialValue = { count: 0 };
      const $state = framecast.state('testState', initialValue);

      expect($state.get()).toEqual(initialValue);
    });

    it('attempts to sync state with other frame on creation', () => {
      const initialValue = { count: 5 };
      framecast.state('syncState', initialValue);

      // Should have attempted to call state:get function
      const calls = mockTargetWindow.postMessage.mock.calls;
      const stateGetCall = calls.find(call => {
        const message = superjson.parse(call[0]) as any;
        return message.type === 'function:state:get:syncState';
      });

      expect(stateGetCall).toBeDefined();
    });
  });
});
