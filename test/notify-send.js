const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Notify = require('../notifiers/notifysend');
const utils = require('../lib/utils');
const os = require('os');

describe('notify-send', function () {
  const original = utils.command;
  const originalType = os.type;

  beforeEach(function () {
    os.type = function () {
      return 'Linux';
    };
  });

  afterEach(function () {
    utils.command = original;
    os.type = originalType;
  });

  function expectArgsListToBe(expected, done) {
    utils.command = function (_notifier, argsList) {
      assert.deepStrictEqual(argsList, expected);
      done();
    };
  }

  it('should pass on title and body', function (_context, done) {
    const expected = ['"title"', '"body"', '--expire-time', '"10000"'];
    expectArgsListToBe(expected, done);
    const notifier = new Notify({ suppressOsdCheck: true });
    notifier.notify({ title: 'title', message: 'body' });
  });

  it('should pass have default title', function (_context, done) {
    const expected = [
      '"Node Notification:"',
      '"body"',
      '--expire-time',
      '"10000"'
    ];

    expectArgsListToBe(expected, done);
    const notifier = new Notify({ suppressOsdCheck: true });
    notifier.notify({ message: 'body' });
  });

  it('should throw error if no message is passed', function (_context, done) {
    utils.command = function (_notifier, argsList) {
      assert.strictEqual(argsList, undefined);
    };

    const notifier = new Notify({ suppressOsdCheck: true });
    notifier.notify({}, function (err) {
      assert.strictEqual(err.message, 'Message is required.');
      done();
    });
  });

  it('should escape message input', function (_context, done) {
    const excapedNewline = process.platform === 'win32' ? '\\r\\n' : '\\n';
    const expected = [
      '"Node Notification:"',
      '"some' + excapedNewline + ' \\"me\'ss\\`age\\`\\""',
      '--expire-time',
      '"10000"'
    ];

    expectArgsListToBe(expected, done);
    const notifier = new Notify({ suppressOsdCheck: true });
    notifier.notify({ message: 'some\n "me\'ss`age`"' });
  });

  it('should escape array items as normal items', function (_context, done) {
    const expected = [
      '"Hacked"',
      '"\\`touch HACKED\\`"',
      '--app-name',
      '"foo\\`touch exploit\\`"',
      '--category',
      '"foo\\`touch exploit\\`"',
      '--expire-time',
      '"10000"'
    ];

    expectArgsListToBe(expected, done);
    const notifier = new Notify({ suppressOsdCheck: true });
    const options = JSON.parse(
      `{
        "title": "Hacked",
        "message":["\`touch HACKED\`"],
        "app-name": ["foo\`touch exploit\`"],
        "category": ["foo\`touch exploit\`"]
      }`
    );
    notifier.notify(options);
  });

  it('should send additional parameters as --"keyname"', function (_context, done) {
    const expected = [
      '"title"',
      '"body"',
      '--icon',
      '"icon-string"',
      '--expire-time',
      '"10000"'
    ];

    expectArgsListToBe(expected, done);
    const notifier = new Notify({ suppressOsdCheck: true });
    notifier.notify({ title: 'title', message: 'body', icon: 'icon-string' });
  });

  it('should remove extra options that are not supported by notify-send', function (_context, done) {
    const expected = [
      '"title"',
      '"body"',
      '--icon',
      '"icon-string"',
      '--expire-time',
      '"1000"'
    ];

    expectArgsListToBe(expected, done);
    const notifier = new Notify({ suppressOsdCheck: true });
    notifier.notify({
      title: 'title',
      message: 'body',
      icon: 'icon-string',
      time: 1,
      tullball: 'notValid'
    });
  });
});
