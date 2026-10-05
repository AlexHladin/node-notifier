const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Notify = require('../notifiers/growl');
const growly = require('growly');

describe('growl', function () {
  let original;
  beforeEach(function () {
    original = growly.notify;
  });

  afterEach(function () {
    growly.notify = original;
  });

  it('should have overridable host and port', function () {
    let notifier = new Notify();
    assert.strictEqual(notifier.options.host, undefined);
    assert.strictEqual(notifier.options.port, undefined);

    notifier = new Notify({ host: 'foo', port: 'bar' });
    assert.strictEqual(notifier.options.host, 'foo');
    assert.strictEqual(notifier.options.port, 'bar');
  });

  it('should pass host and port to growly', function (_context, done) {
    growly.notify = function () {
      assert.strictEqual(this.host, 'foo');
      assert.strictEqual(this.port, 'bar');
      done();
    };

    const notifier = new Notify({ host: 'foo', port: 'bar' });
    notifier.notify({ message: 'foo', wait: true });
  });

  it('should not override host/port if no options passed', function (_context, done) {
    growly.notify = function () {
      assert.strictEqual(this.host, undefined);
      assert.strictEqual(this.port, undefined);
      done();
    };
    new Notify().notify({ message: 'foo', wait: true });
  });
});
