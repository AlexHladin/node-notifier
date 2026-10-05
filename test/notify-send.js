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

  it('passes raw title and body after an option terminator', function (_context, done) {
    expectArgsListToBe(['--expire-time', '10000', '--', 'title', 'body'], done);
    new Notify({ suppressOsdCheck: true }).notify({
      title: 'title',
      message: 'body'
    });
  });

  it('uses the default title', function (_context, done) {
    expectArgsListToBe(
      ['--expire-time', '10000', '--', 'Node Notification:', 'body'],
      done
    );
    new Notify({ suppressOsdCheck: true }).notify({ message: 'body' });
  });

  it('reports a missing message', function (_context, done) {
    utils.command = function () {
      assert.fail('Notification must not execute');
    };
    new Notify({ suppressOsdCheck: true }).notify({}, function (error) {
      assert.strictEqual(error.message, 'Message is required.');
      done();
    });
  });

  it('preserves quotes, newlines, backslashes, and shell syntax as text', function (_context, done) {
    const message = 'some\n "quotes" \\ $HOME $(ignored) `ignored`; Unicode ☃';
    expectArgsListToBe(
      ['--expire-time', '10000', '--', 'Node Notification:', message],
      done
    );
    new Notify({ suppressOsdCheck: true }).notify({ message });
  });

  it('joins array values without shell quoting or stripping newlines', function (_context, done) {
    expectArgsListToBe(
      [
        '--app-name',
        'foo`touch exploit`',
        '--category',
        'first\nline,second',
        '--expire-time',
        '10000',
        '--',
        'Hacked',
        '`touch HACKED`'
      ],
      done
    );
    new Notify({ suppressOsdCheck: true }).notify({
      title: 'Hacked',
      message: ['`touch HACKED`'],
      'app-name': ['foo`touch exploit`'],
      category: ['first\nline', 'second']
    });
  });

  it('passes supported flags as separate arguments', function (_context, done) {
    expectArgsListToBe(
      [
        '--icon',
        'icon-string',
        '--expire-time',
        '10000',
        '--',
        'title',
        'body'
      ],
      done
    );
    new Notify({ suppressOsdCheck: true }).notify({
      title: 'title',
      message: 'body',
      icon: 'icon-string'
    });
  });

  it('filters unsupported options and maps expiration time', function (_context, done) {
    expectArgsListToBe(
      ['--icon', 'icon-string', '--expire-time', '1000', '--', 'title', 'body'],
      done
    );
    new Notify({ suppressOsdCheck: true }).notify({
      title: 'title',
      message: 'body',
      icon: 'icon-string',
      time: 1,
      tullball: 'notValid'
    });
  });

  it('does not interpret leading dashes in notification text as flags', function (_context, done) {
    expectArgsListToBe(
      ['--expire-time', '10000', '--', '--help', '--version'],
      done
    );
    new Notify({ suppressOsdCheck: true }).notify({
      title: '--help',
      message: '--version'
    });
  });

  it('executes notify-send directly with raw arguments', function (context) {
    const cp = require('node:child_process');
    const execFile = context.mock.method(
      cp,
      'execFile',
      (file, args, callback) => callback(null, 'output', 'warning')
    );
    context.mock.method(cp, 'exec', () =>
      assert.fail('A shell must not be used')
    );
    const callback = context.mock.fn();
    new Notify({ suppressOsdCheck: true }).notify(
      { title: 'A title', message: '$(ignored); `ignored`' },
      callback
    );
    assert.strictEqual(execFile.mock.callCount(), 1);
    assert.deepStrictEqual(execFile.mock.calls[0].arguments.slice(0, 2), [
      'notify-send',
      ['--expire-time', '10000', '--', 'A title', '$(ignored); `ignored`']
    ]);
    assert.deepStrictEqual(callback.mock.calls[0].arguments, [null, 'output']);
  });

  it('propagates execution errors and stdout', function (context) {
    const cp = require('node:child_process');
    const error = Object.assign(new Error('Missing executable'), {
      code: 'ENOENT'
    });
    context.mock.method(cp, 'execFile', (file, args, callback) =>
      callback(error, 'output')
    );
    const callback = context.mock.fn();
    utils.command('/a path/notifier', ['raw "argument"'], callback);
    assert.deepStrictEqual(callback.mock.calls[0].arguments, [error, 'output']);
  });
});
