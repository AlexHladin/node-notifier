const {
  describe,
  it,
  beforeEach,
  afterEach,
  after,
  mock
} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
mock.method(crypto, 'randomUUID', () => '123456789');
after(() => mock.restoreAll());

const Notify = require('../notifiers/toaster');
const utils = require('../lib/utils');
const path = require('path');
const os = require('os');
const testUtils = require('./_test-utils');

describe('WindowsToaster', function () {
  const original = utils.fileCommand;
  const createNamedPipe = utils.createNamedPipe;
  const originalType = os.type;
  const originalArch = os.arch;
  const originalRelease = os.release;

  beforeEach(function () {
    os.release = function () {
      return '6.2.9200';
    };
    os.type = function () {
      return 'Windows_NT';
    };
    utils.createNamedPipe = () => Promise.resolve(Buffer.from('12345'));
  });

  afterEach(function () {
    utils.fileCommand = original;
    utils.createNamedPipe = createNamedPipe;
    os.type = originalType;
    os.arch = originalArch;
    os.release = originalRelease;
  });

  it('should only pass allowed options and proper named properties', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.ok(testUtils.argsListHas(argsList, '-t'));
      assert.ok(testUtils.argsListHas(argsList, '-m'));
      assert.ok(testUtils.argsListHas(argsList, '-b'));
      assert.ok(testUtils.argsListHas(argsList, '-p'));
      assert.ok(testUtils.argsListHas(argsList, '-id'));
      assert.ok(testUtils.argsListHas(argsList, '-appID'));
      assert.ok(testUtils.argsListHas(argsList, '-pipeName'));
      assert.ok(testUtils.argsListHas(argsList, '-install'));
      assert.ok(testUtils.argsListHas(argsList, '-close'));

      assert.ok(!testUtils.argsListHas(argsList, '-foo'));
      assert.ok(!testUtils.argsListHas(argsList, '-bar'));
      assert.ok(!testUtils.argsListHas(argsList, '-message'));
      assert.ok(!testUtils.argsListHas(argsList, '-title'));
      assert.ok(!testUtils.argsListHas(argsList, '-tb'));
      assert.ok(!testUtils.argsListHas(argsList, '-pid'));
      done();
    };
    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      extra: 'dsakdsa',
      foo: 'bar',
      close: 123,
      bar: true,
      install: '/dsa/',
      appID: 123,
      icon: 'file:///C:/node-notifier/test/fixture/coulson.jpg',
      id: 1337,
      sound: 'Notification.IM',
      actions: ['Ok', 'Cancel']
    });
  });

  it('should pass silent without parameters', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.notStrictEqual(
        testUtils.getOptionValue(argsList, '-silent'),
        'true'
      );
      done();
    };
    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      silent: true
    });
  });

  it('should not have appId', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.ok(!testUtils.argsListHas(argsList, '-appId'));
      done();
    };
    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar'
    });
  });

  it('should translate from notification centers appIcon', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.ok(testUtils.argsListHas(argsList, '-p'));
      done();
    };
    const notifier = new Notify();

    notifier.notify({
      message: 'Heya',
      appIcon: 'file:///C:/node-notifier/test/fixture/coulson.jpg'
    });
  });

  it('should translate from remove to close', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.ok(testUtils.argsListHas(argsList, '-close'));
      assert.ok(!testUtils.argsListHas(argsList, '-remove'));
      done();
    };
    const notifier = new Notify();

    notifier.notify({ message: 'Heya', remove: 3 });
  });

  it('should fail if neither close or message is defined', function (_context, done) {
    const notifier = new Notify();

    notifier.notify({ title: 'Heya' }, function (err) {
      assert.strictEqual(err.message, 'Message or ID to close is required.');
      done();
    });
  });

  it('should pass only close', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList, callback) {
      assert.ok(testUtils.argsListHas(argsList, '-close'));
      callback();
    };
    const notifier = new Notify();

    notifier.notify({ close: 3 }, function (err) {
      assert.ok(!err);
      done();
    });
  });

  it('should pass only message', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList, callback) {
      assert.ok(testUtils.argsListHas(argsList, '-m'));
      callback();
    };
    const notifier = new Notify();

    notifier.notify({ message: 'Hello' }, function (err) {
      assert.ok(!err);
      done();
    });
  });

  it('should pass shorthand message', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList, callback) {
      assert.ok(testUtils.argsListHas(argsList, '-m'));
      callback();
    };
    const notifier = new Notify();

    notifier.notify('hello', function (err) {
      assert.ok(!err);
      done();
    });
  });

  it('should wrap message and title', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(testUtils.getOptionValue(argsList, '-t'), 'Heya');
      assert.strictEqual(testUtils.getOptionValue(argsList, '-m'), 'foo bar');
      done();
    };
    const notifier = new Notify();

    notifier.notify({ title: 'Heya', message: 'foo bar' });
  });

  it('should validate and transform sound to default sound if Mac sound is selected', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(testUtils.getOptionValue(argsList, '-t'), 'Heya');
      assert.strictEqual(
        testUtils.getOptionValue(argsList, '-s'),
        'Notification.Default'
      );
      done();
    };
    const notifier = new Notify();

    notifier.notify({ title: 'Heya', message: 'foo bar', sound: 'Frog' });
  });

  it('should use 32 bit snoreToaster if 32 arch', function (_context, done) {
    os.arch = function () {
      return 'ia32';
    };
    const expected = 'snoretoast-x86.exe';
    utils.fileCommand = function (notifier) {
      assert.ok(notifier.endsWith(expected));
      done();
    };
    new Notify().notify({ title: 'title', message: 'body' });
  });

  it('should default to x64 version', function (_context, done) {
    os.arch = function () {
      return 'x64';
    };
    const expected = 'snoretoast-x64.exe';
    utils.fileCommand = function (notifier) {
      assert.ok(notifier.endsWith(expected));
      done();
    };
    new Notify().notify({ title: 'title', message: 'body' });
  });

  it('sound as true should select default value', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(
        testUtils.getOptionValue(argsList, '-s'),
        'Notification.Default'
      );
      done();
    };
    const notifier = new Notify();

    notifier.notify({ message: 'foo bar', sound: true });
  });

  it('sound as false should be same as silent', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.ok(testUtils.argsListHas(argsList, '-silent'));
      done();
    };
    const notifier = new Notify();

    notifier.notify({ message: 'foo bar', sound: false });
  });

  it('should override sound', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(
        testUtils.getOptionValue(argsList, '-s'),
        'Notification.IM'
      );
      done();
    };
    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      sound: 'Notification.IM'
    });
  });

  it('should parse file protocol URL of icon', function (_context, done) {
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(
        argsList[3],
        'C:\\node-notifier\\test\\fixture\\coulson.jpg'
      );
      done();
    };

    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      icon: 'file:///C:/node-notifier/test/fixture/coulson.jpg'
    });
  });

  it('should not parse local path of icon', function (_context, done) {
    const icon = path.join(__dirname, 'fixture', 'coulson.jpg');
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(argsList[3], icon);
      done();
    };

    const notifier = new Notify();
    notifier.notify({ title: 'Heya', message: 'foo bar', icon: icon });
  });

  it('should not parse normal URL of icon', function (_context, done) {
    const icon = 'http://csscomb.com/img/csscomb.jpg';
    utils.fileCommand = function (_notifier, argsList) {
      assert.strictEqual(argsList[3], icon);
      done();
    };

    const notifier = new Notify();
    notifier.notify({ title: 'Heya', message: 'foo bar', icon: icon });
  });

  it('should build command-line argument for actions array properly', () => {
    utils.fileCommand = function (_notifier, argsList) {
      assert.deepStrictEqual(argsList, [
        '-close',
        '123',
        '-install',
        '/dsa/',
        '-id',
        '1337',
        '-pipeName',
        '\\\\.\\pipe\\notifierPipe-123456789',
        '-p',
        'C:\\node-notifier\\test\\fixture\\coulson.jpg',
        '-m',
        'foo bar',
        '-t',
        'Heya',
        '-s',
        'Notification.IM',
        '-b',
        'Ok;Cancel'
      ]);
    };
    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      extra: 'dsakdsa',
      foo: 'bar',
      close: 123,
      bar: true,
      install: '/dsa/',
      icon: 'file:///C:/node-notifier/test/fixture/coulson.jpg',
      id: 1337,
      sound: 'Notification.IM',
      actions: ['Ok', 'Cancel']
    });
  });

  it('should call custom notifier when customPath is passed via message', (_context, done) => {
    utils.fileCommand = function (notifier) {
      assert.deepStrictEqual(notifier, '/test/customPath/snoretoast-x64.exe');
      done();
    };

    const notifier = new Notify();

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      extra: 'dsakdsa',
      foo: 'bar',
      close: 123,
      bar: true,
      id: 1337,
      sound: 'Notification.IM',
      customPath: '/test/customPath/snoretoast-x64.exe',
      actions: ['Ok', 'Cancel']
    });
  });

  it('should call custom notifier when customPath is passed via constructor', (_context, done) => {
    utils.fileCommand = function (notifier) {
      assert.deepStrictEqual(notifier, '/test/customPath/snoretoast-x64.exe');
      done();
    };

    const notifier = new Notify({
      customPath: '/test/customPath/snoretoast-x64.exe'
    });

    notifier.notify({
      title: 'Heya',
      message: 'foo bar',
      extra: 'dsakdsa',
      foo: 'bar',
      close: 123,
      bar: true,
      id: 1337,
      sound: 'Notification.IM',
      actions: ['Ok', 'Cancel']
    });
  });
});
