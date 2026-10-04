const cp = require('child_process');
const os = require('os');
const NotificationCenter = require('../notifiers/osascript');
const Growl = require('../notifiers/growl');

jest.mock('../notifiers/growl', () => {
  return jest.fn().mockImplementation(function () {
    this.notify = jest.fn().mockReturnThis();
  });
});

// Mock the OS and subprocess so these tests never display a desktop notification.
describe('osascript fallback', function () {
  let execFile;
  let notifier;

  beforeEach(function () {
    jest.clearAllMocks();
    jest.spyOn(os, 'type').mockReturnValue('Darwin');
    jest.spyOn(os, 'release').mockReturnValue('25.0.0');
    execFile = jest
      .spyOn(cp, 'execFile')
      .mockImplementation((file, args, callback) => {
        callback(null, '');
      });
    notifier = new NotificationCenter();
  });

  afterEach(function () {
    jest.restoreAllMocks();
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
    const [file, args] = execFile.mock.calls[0];
    expect(file).toBe('/usr/bin/osascript');
    expect(args.slice(0, 3)).toEqual([
      '-e',
      expect.stringContaining('display notification'),
      '--'
    ]);
    expect(args.slice(3)).toEqual([
      message,
      options.title,
      options.subtitle,
      'Funk'
    ]);
    expect(args[1]).not.toContain(message);
    expect(options).toEqual({
      message,
      title: 'Title "quoted"',
      subtitle: 'Subtitle\nline',
      sound: 'Funk'
    });
  });

  it('supports string notifications and default values', function () {
    expect(notifier.notify('Hello')).toBe(notifier);
    expect(execFile.mock.calls[0][1].slice(3)).toEqual([
      'Hello',
      'node-notifier-v2',
      '',
      ''
    ]);
  });

  it('supports the text alias', function () {
    notifier.notify({ text: 'Hello' });
    expect(execFile.mock.calls[0][1][3]).toBe('Hello');
  });

  it.each([
    [true, 'Bottle'],
    [false, ''],
    ['Funk', 'Funk'],
    ['Notification.Default', 'Bottle']
  ])('maps sound %p to %p', function (sound, expected) {
    notifier.notify({ message: 'Hello', sound });
    expect(execFile.mock.calls[0][1][6]).toBe(expected);
  });

  it('preserves an explicitly empty title', function () {
    notifier.notify({ message: 'Hello', title: '' });
    expect(execFile.mock.calls[0][1][4]).toBe('');
  });

  it('allows a custom osascript executable', function () {
    new NotificationCenter({ customPath: '/custom/osascript' }).notify('Hello');
    expect(execFile.mock.calls[0][0]).toBe('/custom/osascript');
  });

  it('reports script completion without emitting user interaction events', function () {
    const callback = jest.fn();
    const event = jest.fn();
    ['click', 'timeout', 'replied'].forEach((name) => notifier.on(name, event));
    expect(
      notifier.notify(
        {
          message: 'Hello',
          wait: true,
          timeout: 5,
          reply: true,
          actions: ['OK']
        },
        callback
      )
    ).toBe(notifier);
    expect(callback).toHaveBeenCalledWith(null, '', {});
    expect(callback.mock.instances[0]).toBe(notifier);
    expect(event).not.toHaveBeenCalled();
    expect(execFile.mock.calls[0][1]).toHaveLength(7);
  });

  it('passes subprocess errors to the callback', function () {
    const error = new Error('osascript failed');
    execFile.mockImplementation((file, args, callback) =>
      callback(error, 'output')
    );
    const callback = jest.fn();
    notifier.notify('Hello', callback);
    expect(callback).toHaveBeenCalledWith(error, 'output', {});
  });

  it('reports synchronous launch errors through the callback', function () {
    const error = new Error('spawn failed');
    execFile.mockImplementation(() => {
      throw error;
    });
    const callback = jest.fn();
    expect(notifier.notify('Hello', callback)).toBe(notifier);
    expect(callback).toHaveBeenCalledWith(error, '', {});
  });

  it('requires a message even for unsupported list/remove options', function () {
    const callback = jest.fn();
    notifier.notify({ list: 'ALL', remove: 'ALL' }, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
    expect(execFile).not.toHaveBeenCalled();
  });

  it('validates the callback', function () {
    expect(() => notifier.notify('Hello', 123)).toThrow(/^The second argument/);
  });

  it('reports unsupported macOS versions without launching osascript', function () {
    os.release.mockReturnValue('12.0.0');
    const callback = jest.fn();
    notifier.notify('Hello', callback);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('10.9') })
    );
    expect(execFile).not.toHaveBeenCalled();
  });

  it('uses Growl when fallback is enabled on older macOS', function () {
    os.release.mockReturnValue('12.0.0');
    const callback = jest.fn();
    const result = new NotificationCenter({ withFallback: true }).notify(
      'Hello',
      callback
    );
    expect(Growl).toHaveBeenCalledWith({ withFallback: true });
    expect(result.notify).toHaveBeenCalledWith({ message: 'Hello' }, callback);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('does not launch osascript on other platforms', function () {
    os.type.mockReturnValue('Linux');
    const callback = jest.fn();
    notifier.notify('Hello', callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
    expect(execFile).not.toHaveBeenCalled();
  });
});
