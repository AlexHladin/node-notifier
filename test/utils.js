const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const _ = require('../lib/utils');

describe('utils', function () {
  describe('clone', function () {
    it('should clone nested objects', function () {
      const obj = { a: { b: 42 }, c: 123 };
      const obj2 = _.clone(obj);

      assert.deepStrictEqual(obj, obj2);
      obj.a.b += 2;
      obj.c += 2;
      assert.notDeepStrictEqual(obj, obj2);
    });
  });

  describe('mapping', function () {
    it('should map icon for notify-send', function () {
      const expected = {
        title: 'Foo',
        message: 'Bar',
        icon: 'foobar',
        'expire-time': 10000
      };

      assert.deepStrictEqual(
        _.mapToNotifySend({ title: 'Foo', message: 'Bar', appIcon: 'foobar' }),
        expected
      );

      assert.deepStrictEqual(
        _.mapToNotifySend({ title: 'Foo', message: 'Bar', i: 'foobar' }),
        expected
      );
    });

    it('should map short hand for notify-sned', function () {
      const expected = {
        urgency: 'a',
        'expire-time': 'b',
        category: 'c',
        icon: 'd',
        hint: 'e'
      };

      assert.deepStrictEqual(
        _.mapToNotifySend({ u: 'a', e: 'b', c: 'c', i: 'd', h: 'e' }),
        expected
      );
    });

    it('should map icon for notification center', function () {
      const expected = {
        title: 'Foo',
        message: 'Bar',
        appIcon: 'foobar',
        timeout: 10,
        json: true
      };

      assert.deepStrictEqual(
        _.mapToMac({ title: 'Foo', message: 'Bar', icon: 'foobar' }),
        expected
      );

      assert.deepStrictEqual(
        _.mapToMac({ title: 'Foo', message: 'Bar', i: 'foobar' }),
        expected
      );
    });

    it('should map icon for growl', function () {
      const icon = path.join(__dirname, 'fixture', 'coulson.jpg');
      const iconRead = fs.readFileSync(icon);

      const expected = { title: 'Foo', message: 'Bar', icon: iconRead };

      let obj = _.mapToGrowl({ title: 'Foo', message: 'Bar', icon: icon });
      assert.deepStrictEqual(obj, expected);

      assert.ok(obj.icon);
      assert.ok(Buffer.isBuffer(obj.icon));

      obj = _.mapToGrowl({ title: 'Foo', message: 'Bar', appIcon: icon });

      assert.ok(obj.icon);
      assert.ok(Buffer.isBuffer(obj.icon));
    });

    it('should not map icon url for growl', function () {
      const icon = 'http://hostname.com/logo.png';

      const expected = { title: 'Foo', message: 'Bar', icon: icon };

      assert.deepStrictEqual(
        _.mapToGrowl({ title: 'Foo', message: 'Bar', icon: icon }),
        expected
      );

      assert.deepStrictEqual(
        _.mapToGrowl({ title: 'Foo', message: 'Bar', appIcon: icon }),
        expected
      );
    });
  });
});
