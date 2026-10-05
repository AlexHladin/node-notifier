const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('child_process');
const os = require('os');
const NotificationCenter = require('../notifiers/osascript');
const Growl = require('../notifiers/growl');

// Mock the OS and subprocess so these tests never display a desktop notification.
describe('osascript fallback', function () {
  let execFile;
  let notifier;
  let growlNotify;

  beforeEach(function () {
    mock.method(os, 'type', () => 'Darwin');
    mock.method(os, 'release', () => '25.0.0');
    execFile = mock.method(cp, 'execFile', (file, args, callback) => {
      callback(null, '');
    });
    notifier = new NotificationCenter();
    // Growl's notify accessor returns this bound method; stub it to avoid network I/O.
    growlNotify = mock.fn(function () {
      return this;
    });
    Object.defineProperty(Growl.prototype, '_notify', {
      value: growlNotify,
      configurable: true
    });
  });

  afterEach(function () {
    mock.restoreAll();
    delete Growl.prototype._notify;
  });

  it('passes notification text as arguments instead of executable AppleScript', function () {
    const message =
      'Quotes " and \\ and\nUnicode ☃; do shell script "touch /tmp/unwanted"';
    const options = {
      message,
      title: 'Title "quoted"',
      subtitle: 'Subtitle\nline',
      sound: 'Funk'
    };
    notifier.notify(options);
    const [file, args] = execFile.mock.calls[0].arguments;
    assert.strictEqual(file, '/usr/bin/osascript');
    assert.strictEqual(args[0], '-e');
    assert.ok(args[1].includes('display notification'));
    assert.strictEqual(args[2], '--');
    assert.deepStrictEqual(args.slice(3), [
      message,
      options.title,
      options.subtitle,
      'Funk'
    ]);
    assert.ok(!args[1].includes(message));
    assert.deepStrictEqual(options, {
      message,
      title: 'Title "quoted"',
      subtitle: 'Subtitle\nline',
      sound: 'Funk'
    });
  });

  it('supports string notifications and default values', function () {
    assert.strictEqual(notifier.notify('Hello'), notifier);
    assert.deepStrictEqual(execFile.mock.calls[0].arguments[1].slice(3), [
      'Hello',
      'node-notifier-v2',
      '',
      ''
    ]);
  });

  it('supports the text alias', function () {
    notifier.notify({ text: 'Hello' });
    assert.strictEqual(execFile.mock.calls[0].arguments[1][3], 'Hello');
  });

  for (const [sound, expected] of [
    [true, 'Bottle'],
    [false, ''],
    ['Funk', 'Funk'],
    ['Notification.Default', 'Bottle']
  ]) {
    it('maps sound %p to %p' + ': ' + JSON.stringify(sound), function () {
      notifier.notify({ message: 'Hello', sound });
      assert.strictEqual(execFile.mock.calls[0].arguments[1][6], expected);
    });
  }

  it('preserves an explicitly empty title', function () {
    notifier.notify({ message: 'Hello', title: '' });
    assert.strictEqual(execFile.mock.calls[0].arguments[1][4], '');
  });

  it('allows a custom osascript executable', function () {
    new NotificationCenter({ customPath: '/custom/osascript' }).notify('Hello');
    assert.strictEqual(
      execFile.mock.calls[0].arguments[0],
      '/custom/osascript'
    );
  });

  it('reports script completion without emitting user interaction events', function () {
    const callback = mock.fn();
    const event = mock.fn();
    ['click', 'timeout', 'replied'].forEach((name) => notifier.on(name, event));
    assert.strictEqual(
      notifier.notify(
        {
          message: 'Hello',
          wait: true,
          timeout: 5,
          reply: true,
          actions: ['OK']
        },
        callback
      ),
      notifier
    );
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[0], null);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[1], '');
    assert.deepStrictEqual(callback.mock.calls[0].arguments[2], {});
    assert.strictEqual(callback.mock.calls[0].this, notifier);
    assert.strictEqual(event.mock.callCount(), 0);
    assert.strictEqual(execFile.mock.calls[0].arguments[1].length, 7);
  });

  it('passes subprocess errors to the callback', function () {
    const error = new Error('osascript failed');
    execFile.mock.mockImplementation((file, args, callback) =>
      callback(error, 'output')
    );
    const callback = mock.fn();
    notifier.notify('Hello', callback);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[0], error);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[1], 'output');
    assert.deepStrictEqual(callback.mock.calls[0].arguments[2], {});
  });

  it('reports synchronous launch errors through the callback', function () {
    const error = new Error('spawn failed');
    execFile.mock.mockImplementation(() => {
      throw error;
    });
    const callback = mock.fn();
    assert.strictEqual(notifier.notify('Hello', callback), notifier);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[0], error);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[1], '');
    assert.deepStrictEqual(callback.mock.calls[0].arguments[2], {});
  });

  it('requires a message even for unsupported list/remove options', function () {
    const callback = mock.fn();
    notifier.notify({ list: 'ALL', remove: 'ALL' }, callback);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 1);
    assert.ok(callback.mock.calls[0].arguments[0] instanceof Error);
    assert.strictEqual(execFile.mock.callCount(), 0);
  });

  it('validates the callback', function () {
    assert.throws(() => notifier.notify('Hello', 123), {
      message: /^The second argument/
    });
  });

  it('reports unsupported macOS versions without launching osascript', function () {
    os.release.mock.mockImplementation(() => '12.0.0');
    const callback = mock.fn();
    notifier.notify('Hello', callback);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 1);
    assert.ok(callback.mock.calls[0].arguments[0].message.includes('10.9'));
    assert.strictEqual(execFile.mock.callCount(), 0);
  });

  it('uses Growl when fallback is enabled on older macOS', function () {
    os.release.mock.mockImplementation(() => '12.0.0');
    const callback = mock.fn();
    const result = new NotificationCenter({ withFallback: true }).notify(
      'Hello',
      callback
    );
    assert.ok(result instanceof Growl);
    assert.deepStrictEqual(result.options, { withFallback: true });
    assert.strictEqual(result.notify.mock.callCount(), 1);
    assert.strictEqual(result.notify.mock.calls[0].arguments.length, 2);
    assert.deepStrictEqual(result.notify.mock.calls[0].arguments[0], {
      message: 'Hello'
    });
    assert.deepStrictEqual(result.notify.mock.calls[0].arguments[1], callback);
    assert.strictEqual(execFile.mock.callCount(), 0);
  });

  it('does not launch osascript on other platforms', function () {
    os.type.mock.mockImplementation(() => 'Linux');
    const callback = mock.fn();
    notifier.notify('Hello', callback);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 1);
    assert.ok(callback.mock.calls[0].arguments[0] instanceof Error);
    assert.strictEqual(execFile.mock.callCount(), 0);
  });
});
