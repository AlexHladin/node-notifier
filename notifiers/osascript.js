/**
 * macOS notifications using the built-in AppleScript interpreter.
 */
const cp = require('child_process');
const os = require('os');
const utils = require('../lib/utils');
const Growl = require('./growl');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

// Notification text is passed as data, never interpolated into AppleScript.
const script = [
  'on run argv',
  'display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv) sound name (item 4 of argv)',
  'end run'
].join('\n');

module.exports = NotificationCenter;

function NotificationCenter(options) {
  if (!(this instanceof NotificationCenter)) {
    return new NotificationCenter(options);
  }
  this.options = utils.clone(options || {});
  EventEmitter.call(this);
}
util.inherits(NotificationCenter, EventEmitter);

function noop() {}

function notifyRaw(options, callback) {
  options =
    typeof options === 'string'
      ? { message: options }
      : utils.clone(options || {});
  if (callback == null) callback = noop;
  if (typeof callback !== 'function') {
    throw new TypeError(
      'The second argument must be a function callback. You have passed ' +
        typeof callback
    );
  }

  if (!options.message && options.text) options.message = options.text;
  if (!options.message) {
    callback.call(this, new Error('Message property is required.'));
    return this;
  }

  // AppleScript's display notification was introduced in OS X 10.9 (Darwin 13).
  if (!utils.isMac() || parseInt(os.release(), 10) < 13) {
    if (this.options.withFallback) {
      return new Growl(this.options).notify(options, callback);
    }
    callback.call(
      this,
      new Error(
        'You need macOS 10.9 or above to use NotificationCenter, or enable withFallback to use Growl.'
      )
    );
    return this;
  }

  let sound = options.sound;
  if (
    sound === true ||
    (typeof sound === 'string' && sound.indexOf('Notification.') === 0)
  ) {
    sound = 'Bottle';
  }
  const args = [
    '-e',
    script,
    '--',
    String(options.message),
    options.title == null ? 'node-notifier-v2' : String(options.title),
    options.subtitle == null ? '' : String(options.subtitle),
    typeof sound === 'string' ? sound : ''
  ];
  // Completion means the script exited, not that the user saw or clicked the notification.
  const complete = (error, stdout) =>
    callback.call(this, error || null, stdout || '', {});
  try {
    cp.execFile(
      this.options.customPath || '/usr/bin/osascript',
      args,
      complete
    );
  } catch (error) {
    complete(error);
  }
  return this;
}

Object.defineProperty(NotificationCenter.prototype, 'notify', {
  get: function () {
    if (!this._notify) this._notify = notifyRaw.bind(this);
    return this._notify;
  }
});
