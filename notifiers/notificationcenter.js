/**
 * Native macOS notifications, with osascript as a basic fallback.
 */
const cp = require('child_process');
const os = require('os');
const path = require('path');
const utils = require('../lib/utils');
const Growl = require('./growl');
const Osascript = require('./osascript');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const intelNotifier = path.join(
  __dirname,
  '../vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier'
);
const armNotifier = path.join(__dirname, '../vendor/alerter/alerter-arm64');

module.exports = NotificationCenter;

function NotificationCenter(options) {
  if (!(this instanceof NotificationCenter))
    return new NotificationCenter(options);
  this.options = utils.clone(options || {});
  EventEmitter.call(this);
}
util.inherits(NotificationCenter, EventEmitter);

function noop() {}

function requiresNative(options) {
  return [
    'reply',
    'actions',
    'icon',
    'appIcon',
    'contentImage',
    'open',
    'group',
    'list',
    'remove',
    'wait',
    'timeout',
    'closeLabel',
    'dropdownLabel',
    'sender'
  ].some(
    (key) =>
      options[key] !== undefined &&
      options[key] !== null &&
      options[key] !== false
  );
}

function alerterArguments(options) {
  const args = ['--json'];
  const names = {
    title: 'title',
    subtitle: 'subtitle',
    message: 'message',
    sound: 'sound',
    appIcon: 'app-icon',
    contentImage: 'content-image',
    actions: 'actions',
    closeLabel: 'close-label',
    dropdownLabel: 'dropdown-label',
    group: 'group',
    list: 'list',
    remove: 'remove',
    timeout: 'timeout',
    sender: 'sender'
  };
  Object.keys(names).forEach((key) => {
    if (
      options[key] === undefined ||
      options[key] === null ||
      options[key] === false
    )
      return;
    const value = Array.isArray(options[key])
      ? options[key].join(',')
      : String(options[key]);
    args.push('--' + names[key] + '=' + value);
  });
  if (options.reply)
    args.push(
      // Alerter requires a nonempty placeholder, including for boolean reply.
      '--reply=' + (options.reply === true ? 'Reply' : String(options.reply))
    );
  return args;
}

function notifyRaw(options, callback) {
  options =
    typeof options === 'string'
      ? { title: 'node-notifier-v2', message: options }
      : utils.clone(options || {});
  if (callback == null) callback = noop;
  if (typeof callback !== 'function') {
    throw new TypeError(
      'The second argument must be a function callback. You have passed ' +
        typeof callback
    );
  }
  if (!options.message && options.text) options.message = options.text;
  if (!options.message && !options.group && !options.list && !options.remove) {
    callback.call(
      this,
      new Error('Message, group, remove or list property is required.')
    );
    return this;
  }

  const basicFallback = (error) => {
    if (requiresNative(options)) {
      const unsupported = new Error(
        'Native macOS notifications are unavailable. Reply, actions, and other interactive options require a compatible native helper. ' +
          error.message
      );
      unsupported.code = 'ENATIVEUNAVAILABLE';
      unsupported.cause = error;
      callback.call(this, unsupported);
      return;
    }
    new Osascript({ customPath: this.options.osascriptPath }).notify(
      options,
      (error, response, metadata) => {
        callback.call(this, error, response, metadata);
      }
    );
  };

  if (this.options.backend === 'osascript') {
    basicFallback(new Error('The osascript backend was explicitly selected.'));
    return this;
  }

  if (!utils.isMountainLion()) {
    if (this.options.withFallback)
      return new Growl(this.options).notify(options, callback);
    callback.call(
      this,
      new Error(
        'You need macOS 10.8 or above to use NotificationCenter, or enable withFallback to use Growl.'
      )
    );
    return this;
  }

  // A customPath defaults to the legacy terminal-notifier CLI. Set backend:
  // 'alerter' explicitly when overriding the modern ARM helper.
  const alerter =
    this.options.backend === 'alerter' ||
    (!this.options.customPath && os.arch() === 'arm64');
  if (alerter && options.reply && options.actions) {
    callback.call(
      this,
      new Error(
        'The Apple Silicon/Alerter backend supports reply or actions in one notification, not both.'
      )
    );
    return this;
  }
  if (alerter && parseInt(os.release(), 10) < 22) {
    basicFallback(
      new Error('The bundled Apple Silicon helper requires macOS 13 or newer.')
    );
    return this;
  }
  const nativePath =
    this.options.customPath || (alerter ? armNotifier : intelNotifier);
  const nativeOptions = utils.mapToMac(utils.clone(options));
  const args = alerter
    ? alerterArguments(nativeOptions)
    : utils.constructArgumentList(nativeOptions);
  const decorated = utils.actionJackerDecorator(
    this,
    options,
    callback,
    (data) => {
      if (data === 'activate') return 'click';
      if (data === 'timeout') return 'timeout';
      if (data === 'replied') return 'replied';
    }
  );

  const complete = (error, data) => {
    if (
      error &&
      (['ENOENT', 'ENOEXEC', 'EACCES'].includes(error.code) ||
        error.errno === -86)
    ) {
      basicFallback(error);
      return;
    }
    if (!error && alerter && data && !Array.isArray(data)) {
      data = Object.assign({}, data);
      if (
        data.activationType === 'contentsClicked' ||
        data.activationType === 'actionClicked'
      ) {
        data.activationType = 'activate';
      }
      if (options.open && data.activationType === 'activate') {
        cp.execFile('/usr/bin/open', [String(options.open)], (openError) =>
          decorated(openError, data)
        );
        return;
      }
    }
    decorated(error, data);
  };
  try {
    utils.fileCommandJson(nativePath, args, complete);
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
