const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const NotificationCenter = require('../notifiers/notificationcenter');
const Growl = require('../notifiers/growl');
const utils = require('../lib/utils');
const path = require('path');
const os = require('os');
const fs = require('fs');
const testUtils = require('./_test-utils');

let notifier = null;
const originalUtils = utils.fileCommandJson;
const originalMacVersion = utils.isMountainLion;
const originalType = os.type;

describe('Mac fallback', function () {
  const original = utils.isMountainLion;
  const originalMac = utils.isMac;

  afterEach(function () {
    utils.isMountainLion = original;
    utils.isMac = originalMac;
  });

  it('should default to Growl notification if older Mac OSX than 10.8', function (_context, done) {
    utils.isMountainLion = function () {
      return false;
    };
    utils.isMac = function () {
      return true;
    };
    const n = new NotificationCenter({ withFallback: true });
    n.notify({ message: 'Hello World' }, function () {
      assert.ok(this instanceof Growl);
      done();
    });
  });

  it('should not fallback to Growl notification if withFallback is false', function (_context, done) {
    utils.isMountainLion = function () {
      return false;
    };
    utils.isMac = function () {
      return true;
    };
    const n = new NotificationCenter();
    n.notify({ message: 'Hello World' }, function (err) {
      assert.ok(err);
      assert.ok(!(this instanceof Growl));
      done();
    });
  });
});

describe('terminal-notifier', function () {
  beforeEach(function () {
    os.type = function () {
      return 'Darwin';
    };

    utils.isMountainLion = function () {
      return true;
    };
  });

  beforeEach(function () {
    notifier = new NotificationCenter();
  });

  afterEach(function () {
    os.type = originalType;
    utils.isMountainLion = originalMacVersion;
  });

  // Simulate async operation, move to end of message queue.
  function asyncify(fn) {
    return function () {
      const args = arguments;
      setTimeout(function () {
        fn.apply(null, args);
      }, 0);
    };
  }

  describe('#notify()', function () {
    beforeEach(function () {
      utils.fileCommandJson = asyncify(function (_n, _o, cb) {
        cb(null, '');
      });
    });

    afterEach(function () {
      utils.fileCommandJson = originalUtils;
    });

    it('should notify with a message', function (_context, done) {
      notifier.notify({ message: 'Hello World' }, function (err) {
        assert.strictEqual(err, null);
        done();
      });
    });

    it('should be chainable', function (_context, done) {
      notifier
        .notify({ message: 'First test' })
        .notify({ message: 'Second test' }, function (err) {
          assert.strictEqual(err, null);
          done();
        });
    });

    it('should be able to list all notifications', function (_context, done) {
      utils.fileCommandJson = asyncify(function (_n, _o, cb) {
        cb(
          null,
          fs
            .readFileSync(path.join(__dirname, '/fixture/listAll.txt'))
            .toString()
        );
      });

      notifier.notify({ list: 'ALL' }, function (_, response) {
        assert.ok(response);
        done();
      });
    });

    it('should be able to remove all messages', function (_context, done) {
      utils.fileCommandJson = asyncify(function (_n, _o, cb) {
        cb(
          null,
          fs
            .readFileSync(path.join(__dirname, '/fixture/removeAll.txt'))
            .toString()
        );
      });

      notifier.notify({ remove: 'ALL' }, function (_, response) {
        assert.ok(response);

        utils.fileCommandJson = asyncify(function (_n, _o, cb) {
          cb(null, '');
        });

        notifier.notify({ list: 'ALL' }, function (_, response) {
          assert.ok(!response);
          done();
        });
      });
    });
  });

  describe('arguments', function () {
    let original;
    beforeEach(function () {
      original = utils.fileCommandJson;
    });

    afterEach(function () {
      utils.fileCommandJson = original;
    });

    function expectArgsListToBe(expected, done) {
      utils.fileCommandJson = asyncify(function (
        _notifier,
        argsList,
        callback
      ) {
        assert.deepStrictEqual(argsList, expected);
        callback();
        done();
      });
    }

    it('should allow for non-sensical arguments (fail gracefully)', function (_context, done) {
      const expected = [
        '-title',
        '"title"',
        '-message',
        '"body"',
        '-tullball',
        '"notValid"',
        '-timeout',
        '"10"',
        '-json',
        '"true"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'title',
        message: 'body',
        tullball: 'notValid'
      });
    });

    it('should validate and transform sound to default sound if Windows sound is selected', function (_context, done) {
      utils.fileCommandJson = asyncify(function (
        _notifier,
        argsList,
        callback
      ) {
        assert.strictEqual(
          testUtils.getOptionValue(argsList, '-title'),
          '"Heya"'
        );
        assert.strictEqual(
          testUtils.getOptionValue(argsList, '-sound'),
          '"Bottle"'
        );
        callback();
        done();
      });
      const notifier = new NotificationCenter();
      notifier.notify({
        title: 'Heya',
        message: 'foo bar',
        sound: 'Notification.Default'
      });
    });

    it('should convert list of actions to flat list', function (_context, done) {
      const expected = [
        '-title',
        '"title \\"message\\""',
        '-message',
        '"body \\"message\\""',
        '-actions',
        '"foo","bar","baz \\"foo\\" bar"',
        '-timeout',
        '"10"',
        '-json',
        '"true"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'title "message"',
        message: 'body "message"',
        actions: ['foo', 'bar', 'baz "foo" bar']
      });
    });

    it('should still support wait flag with default timeout', function (_context, done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"5"',
        '-json',
        '"true"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({ title: 'Title', message: 'Message', wait: true });
    });

    it('should let timeout set precedence over wait', function (_context, done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-timeout',
        '"10"',
        '-json',
        '"true"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'Title',
        message: 'Message',
        wait: true,
        timeout: 10
      });
    });

    it('should not set a default timeout if explicitly false', function (_context, done) {
      const expected = [
        '-title',
        '"Title"',
        '-message',
        '"Message"',
        '-json',
        '"true"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'Title',
        message: 'Message',
        timeout: false
      });
    });

    it('should escape all title and message', function (_context, done) {
      const expected = [
        '-title',
        '"title \\"message\\""',
        '-message',
        '"body \\"message\\""',
        '-tullball',
        '"notValid"',
        '-timeout',
        '"10"',
        '-json',
        '"true"'
      ];

      expectArgsListToBe(expected, done);
      const notifier = new NotificationCenter();
      notifier.isNotifyChecked = true;
      notifier.hasNotifier = true;

      notifier.notify({
        title: 'title "message"',
        message: 'body "message"',
        tullball: 'notValid'
      });
    });
  });
});
