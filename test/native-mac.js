const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('child_process');
const os = require('os');
const utils = require('../lib/utils');
const NotificationCenter = require('../notifiers/notificationcenter');

describe('native macOS backend selection and interaction', function () {
  let native;
  let execFile;

  beforeEach(function () {
    mock.method(os, 'type', () => 'Darwin');
    mock.method(os, 'arch', () => 'arm64');
    mock.method(os, 'release', () => '25.0.0');
    native = mock.method(utils, 'fileCommandJson', (file, args, callback) =>
      callback(null, {})
    );
    execFile = mock.method(cp, 'execFile', (file, args, callback) =>
      callback(null, '')
    );
  });

  afterEach(function () {
    mock.restoreAll();
  });

  it('selects the bundled ARM64 helper with reply and native argument syntax', function () {
    new NotificationCenter().notify({
      message: '--json "Unicode ☃"\nline',
      reply: true,
      sound: true
    });
    const [file, args] = native.mock.calls[0].arguments;
    assert.ok(file.endsWith('/vendor/alerter/alerter-arm64'));
    assert.ok(args.includes('--json'));
    assert.ok(args.includes('--message=--json "Unicode ☃"\nline'));
    assert.ok(args.includes('--reply=Reply'));
    assert.ok(args.includes('--sound=Bottle'));
    assert.ok(args.includes('--timeout=10'));
    assert.ok(!args.includes('--reply='));
    assert.strictEqual(execFile.mock.callCount(), 0);
  });

  it('retains reply text and metadata in callbacks and replied events', function () {
    const metadata = {
      activationType: 'replied',
      activationValue: 'My typed response',
      activationAt: 'now'
    };
    native.mock.mockImplementation((file, args, callback) =>
      callback(null, metadata)
    );
    const notifier = new NotificationCenter();
    const callback = mock.fn();
    const event = mock.fn();
    notifier.on('replied', event);
    assert.strictEqual(
      notifier.notify({ message: 'Question?', reply: true }, callback),
      notifier
    );
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[0], null);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[1], 'replied');
    assert.deepStrictEqual(callback.mock.calls[0].arguments[2], metadata);
    assert.strictEqual(event.mock.callCount(), 1);
    assert.strictEqual(event.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(event.mock.calls[0].arguments[0], notifier);
    assert.deepStrictEqual(event.mock.calls[0].arguments[1], {
      message: 'Question?',
      reply: true
    });
    assert.deepStrictEqual(event.mock.calls[0].arguments[2], metadata);
  });

  for (const type of ['contentsClicked', 'actionClicked']) {
    it('maps %s to a click event' + ': ' + JSON.stringify(type), function () {
      native.mock.mockImplementation((file, args, callback) =>
        callback(null, { activationType: type, activationValue: 'Yes' })
      );
      const notifier = new NotificationCenter();
      const event = mock.fn();
      notifier.on('click', event);
      const callback = mock.fn();
      notifier.notify(
        {
          message: 'Question?',
          actions: ['Yes', 'No'],
          dropdownLabel: 'Choose',
          closeLabel: 'Cancel'
        },
        callback
      );
      assert.ok(native.mock.calls[0].arguments[1].includes('--actions=Yes,No'));
      assert.ok(
        native.mock.calls[0].arguments[1].includes('--dropdown-label=Choose')
      );
      assert.ok(
        native.mock.calls[0].arguments[1].includes('--close-label=Cancel')
      );
      assert.strictEqual(callback.mock.callCount(), 1);
      assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
      assert.deepStrictEqual(callback.mock.calls[0].arguments[0], null);
      assert.deepStrictEqual(callback.mock.calls[0].arguments[1], 'activate');
      assert.deepStrictEqual(
        callback.mock.calls[0].arguments[2].activationValue,
        'Yes'
      );
      assert.ok(event.mock.callCount() > 0);
    });
  }

  it('maps timeout metadata to a timeout event', function () {
    native.mock.mockImplementation((file, args, callback) =>
      callback(null, { activationType: 'timeout' })
    );
    const notifier = new NotificationCenter();
    const event = mock.fn();
    notifier.on('timeout', event);
    notifier.notify({ message: 'Hello', wait: true });
    assert.ok(native.mock.calls[0].arguments[1].includes('--timeout=5'));
    assert.ok(event.mock.callCount() > 0);
  });

  it('allows no timeout and preserves placeholders, icons, images, and groups', function () {
    new NotificationCenter().notify({
      message: 'Hello',
      reply: 'Type here',
      timeout: false,
      icon: '/icon.png',
      contentImage: '/photo.png',
      group: 'test',
      sender: 'example.sender'
    });
    const args = native.mock.calls[0].arguments[1];
    assert.ok(args.includes('--reply=Type here'));
    assert.ok(args.includes('--app-icon=/icon.png'));
    assert.ok(args.includes('--content-image=/photo.png'));
    assert.ok(args.includes('--group=test'));
    assert.ok(args.includes('--sender=example.sender'));
    assert.strictEqual(
      args.some((arg) => arg.startsWith('--timeout')),
      false
    );
  });

  it('supports listing and removal without a message', function () {
    const notifier = new NotificationCenter();
    notifier.notify({ list: 'ALL' });
    notifier.notify({ remove: 'group' });
    assert.ok(native.mock.calls[0].arguments[1].includes('--list=ALL'));
    assert.ok(native.mock.calls[1].arguments[1].includes('--remove=group'));
  });

  it('opens URLs on native clicks without running a shell', function () {
    native.mock.mockImplementation((file, args, callback) =>
      callback(null, { activationType: 'contentsClicked' })
    );
    const callback = mock.fn();
    new NotificationCenter().notify(
      { message: 'Hello', open: 'https://example.com/?q=$(ignored)' },
      callback
    );
    assert.deepStrictEqual(execFile.mock.calls[0].arguments.slice(0, 2), [
      '/usr/bin/open',
      ['https://example.com/?q=$(ignored)']
    ]);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[0], null);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[1], 'activate');
    assert.ok(callback.mock.calls[0].arguments[2] instanceof Object);
  });

  it('selects the existing Intel application on Intel Macs', function () {
    os.arch.mock.mockImplementation(() => 'x64');
    new NotificationCenter().notify({ message: 'Hello', reply: true });
    assert.ok(
      native.mock.calls[0].arguments[0].endsWith(
        '/vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier'
      )
    );
    assert.ok(native.mock.calls[0].arguments[1].includes('-reply'));
  });

  it('supports explicit custom native helpers', function () {
    const n = new NotificationCenter({ customPath: '/custom/notifier' });
    n.notify('Hello');
    assert.strictEqual(native.mock.calls[0].arguments[0], '/custom/notifier');
    assert.ok(native.mock.calls[0].arguments[1].includes('-message'));
    new NotificationCenter({
      customPath: '/custom/alerter',
      backend: 'alerter'
    }).notify('Hello');
    assert.ok(native.mock.calls[1].arguments[1].includes('--message=Hello'));
  });

  for (const sync of [false, true]) {
    it(
      'falls back for basic notifications when native launch errors are synchronous=%p' +
        ': ' +
        JSON.stringify(sync),
      function () {
        const error = Object.assign(new Error('Bad CPU type'), { errno: -86 });
        native.mock.mockImplementation((file, args, callback) => {
          if (sync) throw error;
          callback(error);
        });
        const notifier = new NotificationCenter();
        const callback = mock.fn();
        notifier.notify('Hello', callback);
        assert.strictEqual(
          execFile.mock.calls[0].arguments[0],
          '/usr/bin/osascript'
        );
        assert.strictEqual(callback.mock.callCount(), 1);
        assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
        assert.deepStrictEqual(callback.mock.calls[0].arguments[0], null);
        assert.deepStrictEqual(callback.mock.calls[0].arguments[1], '');
        assert.deepStrictEqual(callback.mock.calls[0].arguments[2], {});
        assert.strictEqual(callback.mock.calls[0].this, notifier);
      }
    );
  }

  it('does not silently discard input support when native launch fails', function () {
    native.mock.mockImplementation((file, args, callback) =>
      callback(Object.assign(new Error('Missing helper'), { code: 'ENOENT' }))
    );
    const callback = mock.fn();
    new NotificationCenter().notify(
      { message: 'Question?', reply: true },
      callback
    );
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 1);
    assert.deepStrictEqual(
      callback.mock.calls[0].arguments[0].code,
      'ENATIVEUNAVAILABLE'
    );
    assert.strictEqual(execFile.mock.callCount(), 0);
  });

  it('rejects combining reply and actions rather than dropping the input field', function () {
    const callback = mock.fn();
    new NotificationCenter().notify(
      { message: 'Question?', reply: true, actions: ['Yes'] },
      callback
    );
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 1);
    assert.ok(
      callback.mock.calls[0].arguments[0].message.includes('reply or actions')
    );
    assert.strictEqual(native.mock.callCount(), 0);
  });

  it('preserves independent events for concurrent notifications', function () {
    const completions = [];
    native.mock.mockImplementation((file, args, callback) =>
      completions.push(callback)
    );
    const notifier = new NotificationCenter();
    const event = mock.fn();
    notifier.on('replied', event);
    notifier.notify({ message: 'First', reply: true });
    notifier.notify({ message: 'Second', reply: true });
    completions[0](null, { activationType: 'replied', activationValue: 'One' });
    completions[1](null, { activationType: 'replied', activationValue: 'Two' });
    assert.strictEqual(event.mock.callCount(), 2);
  });

  it('uses basic fallback on Apple Silicon macOS versions before 13', function () {
    os.release.mock.mockImplementation(() => '21.0.0');
    new NotificationCenter().notify('Hello');
    assert.strictEqual(native.mock.callCount(), 0);
    assert.strictEqual(
      execFile.mock.calls[0].arguments[0],
      '/usr/bin/osascript'
    );
  });

  it('allows explicitly selecting the basic osascript backend', function () {
    new NotificationCenter({ backend: 'osascript' }).notify('Hello');
    assert.strictEqual(native.mock.callCount(), 0);
    assert.strictEqual(
      execFile.mock.calls[0].arguments[0],
      '/usr/bin/osascript'
    );
  });

  it('does not fall back for unrelated native errors', function () {
    const error = new Error('Notification failed');
    native.mock.mockImplementation((file, args, callback) => callback(error));
    const callback = mock.fn();
    new NotificationCenter().notify('Hello', callback);
    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(callback.mock.calls[0].arguments.length, 3);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[0], error);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[1], undefined);
    assert.deepStrictEqual(callback.mock.calls[0].arguments[2], {});
    assert.strictEqual(execFile.mock.callCount(), 0);
  });
});
