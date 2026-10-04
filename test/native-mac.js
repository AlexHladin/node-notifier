const cp = require('child_process');
const os = require('os');
const utils = require('../lib/utils');
const NotificationCenter = require('../notifiers/notificationcenter');

describe('native macOS backend selection and interaction', function () {
  let native;
  let execFile;

  beforeEach(function () {
    jest.spyOn(os, 'type').mockReturnValue('Darwin');
    jest.spyOn(os, 'arch').mockReturnValue('arm64');
    jest.spyOn(os, 'release').mockReturnValue('25.0.0');
    native = jest
      .spyOn(utils, 'fileCommandJson')
      .mockImplementation((file, args, callback) => callback(null, {}));
    execFile = jest
      .spyOn(cp, 'execFile')
      .mockImplementation((file, args, callback) => callback(null, ''));
  });

  afterEach(function () {
    jest.restoreAllMocks();
  });

  it('selects the bundled ARM64 helper with reply and native argument syntax', function () {
    new NotificationCenter().notify({
      message: '--json "Unicode ☃"\nline',
      reply: true,
      sound: true
    });
    const [file, args] = native.mock.calls[0];
    expect(file).toEndWith('/vendor/alerter/alerter-arm64');
    expect(args).toEqual(
      expect.arrayContaining([
        '--json',
        '--message=--json "Unicode ☃"\nline',
        '--reply=Reply',
        '--sound=Bottle',
        '--timeout=10'
      ])
    );
    expect(args).not.toContain('--reply=');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('retains reply text and metadata in callbacks and replied events', function () {
    const metadata = {
      activationType: 'replied',
      activationValue: 'My typed response',
      activationAt: 'now'
    };
    native.mockImplementation((file, args, callback) =>
      callback(null, metadata)
    );
    const notifier = new NotificationCenter();
    const callback = jest.fn();
    const event = jest.fn();
    notifier.on('replied', event);
    expect(
      notifier.notify({ message: 'Question?', reply: true }, callback)
    ).toBe(notifier);
    expect(callback).toHaveBeenCalledWith(null, 'replied', metadata);
    expect(event).toHaveBeenCalledWith(
      notifier,
      { message: 'Question?', reply: true },
      metadata
    );
  });

  it.each(['contentsClicked', 'actionClicked'])(
    'maps %s to a click event',
    function (type) {
      native.mockImplementation((file, args, callback) =>
        callback(null, { activationType: type, activationValue: 'Yes' })
      );
      const notifier = new NotificationCenter();
      const event = jest.fn();
      notifier.on('click', event);
      const callback = jest.fn();
      notifier.notify(
        {
          message: 'Question?',
          actions: ['Yes', 'No'],
          dropdownLabel: 'Choose',
          closeLabel: 'Cancel'
        },
        callback
      );
      expect(native.mock.calls[0][1]).toEqual(
        expect.arrayContaining([
          '--actions=Yes,No',
          '--dropdown-label=Choose',
          '--close-label=Cancel'
        ])
      );
      expect(callback).toHaveBeenCalledWith(
        null,
        'activate',
        expect.objectContaining({ activationValue: 'Yes' })
      );
      expect(event).toHaveBeenCalled();
    }
  );

  it('maps timeout metadata to a timeout event', function () {
    native.mockImplementation((file, args, callback) =>
      callback(null, { activationType: 'timeout' })
    );
    const notifier = new NotificationCenter();
    const event = jest.fn();
    notifier.on('timeout', event);
    notifier.notify({ message: 'Hello', wait: true });
    expect(native.mock.calls[0][1]).toContain('--timeout=5');
    expect(event).toHaveBeenCalled();
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
    const args = native.mock.calls[0][1];
    expect(args).toEqual(
      expect.arrayContaining([
        '--reply=Type here',
        '--app-icon=/icon.png',
        '--content-image=/photo.png',
        '--group=test',
        '--sender=example.sender'
      ])
    );
    expect(args.some((arg) => arg.startsWith('--timeout'))).toBe(false);
  });

  it('supports listing and removal without a message', function () {
    const notifier = new NotificationCenter();
    notifier.notify({ list: 'ALL' });
    notifier.notify({ remove: 'group' });
    expect(native.mock.calls[0][1]).toContain('--list=ALL');
    expect(native.mock.calls[1][1]).toContain('--remove=group');
  });

  it('opens URLs on native clicks without running a shell', function () {
    native.mockImplementation((file, args, callback) =>
      callback(null, { activationType: 'contentsClicked' })
    );
    const callback = jest.fn();
    new NotificationCenter().notify(
      { message: 'Hello', open: 'https://example.com/?q=$(ignored)' },
      callback
    );
    expect(execFile.mock.calls[0].slice(0, 2)).toEqual([
      '/usr/bin/open',
      ['https://example.com/?q=$(ignored)']
    ]);
    expect(callback).toHaveBeenCalledWith(null, 'activate', expect.any(Object));
  });

  it('selects the existing Intel application on Intel Macs', function () {
    os.arch.mockReturnValue('x64');
    new NotificationCenter().notify({ message: 'Hello', reply: true });
    expect(native.mock.calls[0][0]).toEndWith(
      '/vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier'
    );
    expect(native.mock.calls[0][1]).toContain('-reply');
  });

  it('supports explicit custom native helpers', function () {
    const n = new NotificationCenter({ customPath: '/custom/notifier' });
    n.notify('Hello');
    expect(native.mock.calls[0][0]).toBe('/custom/notifier');
    expect(native.mock.calls[0][1]).toContain('-message');
    new NotificationCenter({
      customPath: '/custom/alerter',
      backend: 'alerter'
    }).notify('Hello');
    expect(native.mock.calls[1][1]).toContain('--message=Hello');
  });

  it.each([false, true])(
    'falls back for basic notifications when native launch errors are synchronous=%p',
    function (sync) {
      const error = Object.assign(new Error('Bad CPU type'), { errno: -86 });
      native.mockImplementation((file, args, callback) => {
        if (sync) throw error;
        callback(error);
      });
      const notifier = new NotificationCenter();
      const callback = jest.fn();
      notifier.notify('Hello', callback);
      expect(execFile.mock.calls[0][0]).toBe('/usr/bin/osascript');
      expect(callback).toHaveBeenCalledWith(null, '', {});
      expect(callback.mock.instances[0]).toBe(notifier);
    }
  );

  it('does not silently discard input support when native launch fails', function () {
    native.mockImplementation((file, args, callback) =>
      callback(Object.assign(new Error('Missing helper'), { code: 'ENOENT' }))
    );
    const callback = jest.fn();
    new NotificationCenter().notify(
      { message: 'Question?', reply: true },
      callback
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ENATIVEUNAVAILABLE' })
    );
    expect(execFile).not.toHaveBeenCalled();
  });

  it('rejects combining reply and actions rather than dropping the input field', function () {
    const callback = jest.fn();
    new NotificationCenter().notify(
      { message: 'Question?', reply: true, actions: ['Yes'] },
      callback
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('reply or actions')
      })
    );
    expect(native).not.toHaveBeenCalled();
  });

  it('preserves independent events for concurrent notifications', function () {
    const completions = [];
    native.mockImplementation((file, args, callback) =>
      completions.push(callback)
    );
    const notifier = new NotificationCenter();
    const event = jest.fn();
    notifier.on('replied', event);
    notifier.notify({ message: 'First', reply: true });
    notifier.notify({ message: 'Second', reply: true });
    completions[0](null, { activationType: 'replied', activationValue: 'One' });
    completions[1](null, { activationType: 'replied', activationValue: 'Two' });
    expect(event).toHaveBeenCalledTimes(2);
  });

  it('uses basic fallback on Apple Silicon macOS versions before 13', function () {
    os.release.mockReturnValue('21.0.0');
    new NotificationCenter().notify('Hello');
    expect(native).not.toHaveBeenCalled();
    expect(execFile.mock.calls[0][0]).toBe('/usr/bin/osascript');
  });

  it('allows explicitly selecting the basic osascript backend', function () {
    new NotificationCenter({ backend: 'osascript' }).notify('Hello');
    expect(native).not.toHaveBeenCalled();
    expect(execFile.mock.calls[0][0]).toBe('/usr/bin/osascript');
  });

  it('does not fall back for unrelated native errors', function () {
    const error = new Error('Notification failed');
    native.mockImplementation((file, args, callback) => callback(error));
    const callback = jest.fn();
    new NotificationCenter().notify('Hello', callback);
    expect(callback).toHaveBeenCalledWith(error, undefined, {});
    expect(execFile).not.toHaveBeenCalled();
  });
});
