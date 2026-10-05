const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const notifier = require('../');

describe('constructors', function () {
  beforeEach(function (context) {
    // Constructor checks must not launch desktop notification tools.
    context.mock.method(cp, 'execFile', (_file, _args, callback) => {
      callback(null, '');
    });
    context.mock.method(cp, 'exec', (_command, callback) => {
      callback(null, '');
    });
  });
  it('should expose a default selected instance', function () {
    assert.ok(notifier.notify);
  });

  it('should expect only a function callback as second parameter', function () {
    function cb() {}
    assert.ok(notifier.notify({ title: 'My notification' }, cb));
  });

  it('should throw error when second parameter is not a function', function () {
    const wrongParamOne = 200;
    const wrongParamTwo = 'meaningless string';
    const data = { title: 'My notification' };

    const base = notifier.notify.bind(notifier, data);
    assert.throws(base.bind(notifier, wrongParamOne), {
      message: /^The second argument/
    });
    assert.throws(base.bind(notifier, wrongParamTwo), {
      message: /^The second argument/
    });
  });

  it('should expose a default selected constructor function', function () {
    assert.ok(notifier instanceof notifier.Notification);
  });

  it('should expose constructor for WindowsBalloon', function () {
    assert.ok(notifier.WindowsBalloon);
  });

  it('should expose constructor for WindowsToaster', function () {
    assert.ok(notifier.WindowsToaster);
  });

  it('should expose constructor for NotifySend', function () {
    assert.ok(notifier.NotifySend);
  });

  it('should expose constructor for Growl', function () {
    assert.ok(notifier.Growl);
  });
});
