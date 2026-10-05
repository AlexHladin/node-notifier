# node-notifier-v2 [![NPM version][npm-image]][npm-url] [![Install size][size-image]][size-url] [![Build Status][travis-image]][travis-url]

`node-notifier-v2` is a new version of the [node-notifier](https://github.com/mikaelbr/node-notifier) library, maintained as a fork under a new package name.

Send cross platform native notifications using Node.js. Native Notification Center for macOS (Intel and Apple Silicon),
`notify-osd`/`libnotify-bin` for Linux, Toasters for Windows 8/10, or taskbar balloons for
earlier Windows versions. Growl is used if none of these requirements are met.
[Works well with Electron](#within-electron-packaging).

![macOS Screenshot](https://raw.githubusercontent.com/mikaelbr/node-notifier/master/example/mac.png)
![Native Windows Screenshot](https://raw.githubusercontent.com/mikaelbr/node-notifier/master/example/windows.png)

## Input Example macOS Notification Center

![Input Example](https://raw.githubusercontent.com/mikaelbr/node-notifier/master/example/input-example.gif)

## Actions Example Windows SnoreToast

![Actions Example](https://raw.githubusercontent.com/mikaelbr/node-notifier/master/example/windows-actions-example.gif)

## Quick Usage

Show a native notification on macOS, Windows, Linux:

```javascript
const notifier = require('node-notifier-v2');
// String
notifier.notify('Message');

// Object
notifier.notify({
  title: 'My notification',
  message: 'Hello, there!'
});
```

## Updating from node-notifier

Replace the original package with `node-notifier-v2`:

```shell
npm uninstall node-notifier
npm install --save node-notifier-v2
```

Update your imports or `require` calls to use the new package name:

```javascript
// Before
const notifier = require('node-notifier');

// After
const notifier = require('node-notifier-v2');
```

For ES modules, change `import notifier from 'node-notifier'` to
`import notifier from 'node-notifier-v2'`. Also update any direct reporter imports
(for example, `node-notifier/notifiers/toaster` becomes
`node-notifier-v2/notifiers/toaster`) and packaging configuration paths that refer
to `node_modules/node-notifier`.

The notification API remains available, including macOS reply fields, actions,
and interaction events. Intel Macs use the original terminal-notifier helper;
Apple Silicon Macs use the bundled ARM64 Alerter helper on macOS 13 or newer.
See [macOS usage](#usage-notificationcenter) for helper selection and basic fallback behavior.

## Requirements

- **macOS**: Intel >= 10.8 with bundled terminal-notifier; Apple Silicon >= 13 with bundled ARM64 Alerter. No Rosetta is needed for the ARM64 helper. Basic notifications can use built-in `osascript` on macOS >= 10.9 when a native helper cannot launch. Growl is the fallback on older systems.
- **Linux**: `notify-osd` or `libnotify-bin` installed (Ubuntu should have this by default)
- **Windows**: >= 8, or task bar balloons for Windows < 8. Growl as fallback. Growl takes precedence over Windows balloons.
- **General Fallback**: Growl

See [documentation and flow chart for reporter choice](./DECISION_FLOW.md).

## Install

```shell
npm install --save node-notifier-v2
```

## <abbr title="Command Line Interface">CLI</abbr>

<abbr title="Command Line Interface">CLI</abbr> has moved to separate project:
<https://github.com/mikaelbr/node-notifier-cli>

## Cross-Platform Advanced Usage

Standard usage, with cross-platform fallbacks as defined in the
[reporter flow chart](./DECISION_FLOW.md). All of the options
below will work in some way or another on most platforms.

```javascript
const notifier = require('node-notifier-v2');
const path = require('path');

notifier.notify(
  {
    title: 'My awesome title',
    message: 'Hello from node, Mr. User!',
    icon: path.join(__dirname, 'coulson.jpg'), // Absolute path (doesn't work on balloons)
    sound: true, // Only Notification Center or Windows Toasters
    wait: true // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
  },
  function (err, response, metadata) {
    // Response is response from notification
    // Metadata contains activationType, activationAt, deliveredAt
  }
);

notifier.on('click', function (notifierObject, options, event) {
  // Triggers if `wait: true` and user clicks notification
});

notifier.on('timeout', function (notifierObject, options) {
  // Triggers if `wait: true` and notification closes
});
```

If you want super fine-grained control, you can customize each reporter individually,
allowing you to tune specific options for different systems.

See below for documentation on each reporter.

**Example:**

```javascript
const NotificationCenter = require('node-notifier-v2/notifiers/notificationcenter');
new NotificationCenter(options).notify();

const NotifySend = require('node-notifier-v2/notifiers/notifysend');
new NotifySend(options).notify();

const WindowsToaster = require('node-notifier-v2/notifiers/toaster');
new WindowsToaster(options).notify();

const Growl = require('node-notifier-v2/notifiers/growl');
new Growl(options).notify();

const WindowsBalloon = require('node-notifier-v2/notifiers/balloon');
new WindowsBalloon(options).notify();
```

Or, if you are using several reporters (or you're lazy):

```javascript
// NOTE: Technically, this takes longer to require
const nn = require('node-notifier-v2');

new nn.NotificationCenter(options).notify();
new nn.NotifySend(options).notify();
new nn.WindowsToaster(options).notify(options);
new nn.WindowsBalloon(options).notify(options);
new nn.Growl(options).notify(options);
```

## Contents

- [Notification Center documentation](#usage-notificationcenter)
- [Windows Toaster documentation](#usage-windowstoaster)
- [Windows Balloon documentation](#usage-windowsballoon)
- [Growl documentation](#usage-growl)
- [Notify-send documentation](#usage-notifysend)

### Usage: `NotificationCenter`

The backend automatically selects a bundled native helper:

- **Intel:** the original terminal-notifier application (macOS 10.8+).
- **Apple Silicon:** [Alerter v26.5](https://github.com/vjeantet/alerter/releases/tag/v26.5),
  a reply-capable terminal-notifier successor (macOS 13+).

Both provide reply/input fields, action buttons, notification groups, and
interaction metadata. The JavaScript API translates the different helper CLIs
and maps their events to `click`, `timeout`, and `replied`.

On Apple Silicon macOS 11/12, or if a native helper is missing or cannot execute,
basic notifications fall back to built-in `osascript`. Interactive requests
return an `ENATIVEUNAVAILABLE` error instead of silently dropping those features.
On older systems, `withFallback: true` enables Growl.

#### Example

Set `reply: true` to show an input field and read the user's text from
`metadata.activationValue`. Set `actions` to a string or array of labels to show
buttons. Listen for `replied` or `click` to handle the interaction.

On Apple Silicon, `reply: true` uses `Reply` as the input placeholder. Supply a
nonempty string such as `reply: 'Type your answer'` to customize it.

```javascript
const notifier = require('node-notifier-v2');

notifier.notify(
  {
    title: 'Question',
    message: 'What is your name?',
    reply: true,
    timeout: 60
  },
  function (error, response, metadata) {
    if (error) return console.error(error);
    if (response === 'replied') console.log(metadata.activationValue);
  }
);
```

Apple Silicon notifications support reply fields **or** action buttons in one
notification; use separate notifications for these interactions. Action arrays
are passed to Alerter as comma-separated labels, so labels should not contain
commas. Icons and attached images rely on macOS private APIs and can vary between
OS releases.

### All notification options with their defaults:

```javascript
const NotificationCenter = require('node-notifier-v2').NotificationCenter;

var notifier = new NotificationCenter({
  withFallback: false, // Use Growl Fallback if <= 10.8
  customPath: undefined // Optional native helper path; see helper selection below
});

notifier.notify(
  {
    title: undefined,
    subtitle: undefined,
    message: undefined,
    sound: false, // Case Sensitive string for location of sound file, or use one of macOS' native sounds (see below)
    icon: 'Terminal Icon', // Absolute Path to Triggering Icon
    contentImage: undefined, // Absolute Path to Attached Image (Content Image)
    open: undefined, // URL to open on Click
    wait: false, // Wait for User Action against Notification or times out. Same as timeout = 5 seconds

    // See `example/macInput.js` for reply and action examples
    timeout: 5, // Takes precedence over wait if both are defined.
    closeLabel: undefined, // String. Label for cancel button
    actions: undefined, // String | Array<String>. Action label or list of labels in case of dropdown
    dropdownLabel: undefined, // String. Label to be used if multiple actions
    reply: false // Boolean. If notification should take input. Value passed as third argument in callback and event emitter.
  },
  function (error, response, metadata) {
    console.log(response, metadata);
  }
);
```

---

**Note:** The `wait` option is shorthand for `timeout: 5`. This just sets a timeout
for 5 seconds. It does _not_ make the notification sticky!

The default `timeout` is 10 seconds, or 5 seconds with `wait: true`. An explicit
`timeout` takes precedence. Use a longer timeout for reply fields and actions.
`timeout: false` disables the timeout; on the Apple Silicon helper this waits
until the user interacts with the notification. Timeouts on Apple Silicon must
be whole seconds.

_Exception:_ If `reply` is defined, it's recommended to set `timeout` to a either
high value, or to nothing at all.

---

**Intel reply/actions require macOS 10.9+. The Apple Silicon helper requires macOS 13+.**

Sound can be one of these: `Basso`, `Blow`, `Bottle`, `Frog`, `Funk`, `Glass`,
`Hero`, `Morse`, `Ping`, `Pop`, `Purr`, `Sosumi`, `Submarine`, `Tink`.

If `sound` is simply `true`, `Bottle` is used.

---

**See Also:**

- [Example: specific Notification Centers](./example/advanced.js)
- [Example: input](./example/macInput.js).

---

**Helper selection and custom paths**

`customPath` overrides the native executable and defaults to the legacy
terminal-notifier CLI. To use another modern Alerter executable, specify
`backend: 'alerter'` along with `customPath`. Keep an app-based helper inside its
application bundle. The bundled Intel app lives in `mac.noindex` to prevent
Spotlight indexing it.

**Basic osascript fallback**

You can explicitly choose basic notifications:

```javascript
const notifier = new (require('node-notifier-v2').NotificationCenter)({
  backend: 'osascript',
  osascriptPath: '/usr/bin/osascript' // Optional override for the basic fallback
});
notifier.notify({ title: 'Hello', message: 'Basic notification', sound: true });
```

This fallback supports `message` (or `text`), `title`, `subtitle`, and `sound`.
It does not support input, actions, icons, `open`, grouping/listing/removal,
`wait`, or `timeout`; requests using these options return an error. It emits no
interaction events. Its callback runs when the script exits with stdout
(normally empty) as the response and `{}` as metadata. Script completion does
not confirm that macOS displayed the notification.

Allow notifications for the sender in System Settings → Notifications and check
Focus settings if nothing appears. Alerter defaults to the Terminal sender;
`osascript` typically uses Script Editor. Native interaction behavior and
permissions still need to be checked on the target Mac.

### Usage: `WindowsToaster`

**Note:** There are some limitations for images in native Windows 8 notifications:

- The image must be a PNG image
- The image must be smaller than 1024×1024 px
- The image must be less than 200kb
- The image must be specified using an absolute path

These limitations are due to the Toast notification system. A good tip is to use
something like `path.join` or `path.delimiter` to keep your paths cross-platform.

From [mikaelbr/gulp-notify#90 (comment)](https://github.com/mikaelbr/gulp-notify/issues/90#issuecomment-129333034)

> You can make it work by going to System > Notifications & Actions. The 'toast'
> app needs to have Banners enabled. (You can activate banners by clicking on the
> 'toast' app and setting the 'Show notification banners' to On)

---

**Windows 10 Fall Creators Update (Version 1709) Note:**

[**Snoretoast**](https://github.com/KDE/snoretoast) is used to get native Windows Toasts!

The default behaviour is to have the underlying toaster applicaton as `appID`.
This works as expected, but shows `SnoreToast` as text in the notification.

With the Fall Creators Update, Notifications on Windows 10 will only work as
expected if a valid `appID` is specified. Your `appID` must be exactly the same
value that was registered during the installation of your app.

You can find the ID of your App by searching the registry for the `appID` you
specified at installation of your app. For example: If you use the squirrel
framework, your `appID` will be something like `com.squirrel.your.app`.

```javascript
const WindowsToaster = require('node-notifier-v2').WindowsToaster;

var notifier = new WindowsToaster({
  withFallback: false, // Fallback to Growl or Balloons?
  customPath: undefined // Relative/Absolute path if you want to use your fork of SnoreToast.exe
});

notifier.notify(
  {
    title: undefined, // String. Required
    message: undefined, // String. Required if remove is not defined
    icon: undefined, // String. Absolute path to Icon
    sound: false, // Bool | String (as defined by http://msdn.microsoft.com/en-us/library/windows/apps/hh761492.aspx)
    id: undefined, // Number. ID to use for closing notification.
    appID: undefined, // String. App.ID and app Name. Defaults to no value, causing SnoreToast text to be visible.
    remove: undefined, // Number. Refer to previously created notification to close.
    install: undefined // String (path, application, app id).  Creates a shortcut <path> in the start menu which point to the executable <application>, appID used for the notifications.
  },
  function (error, response) {
    console.log(response);
  }
);
```

### Usage: `Growl`

```javascript
const Growl = require('node-notifier-v2').Growl;

var notifier = new Growl({
  name: 'Growl Name Used', // Defaults as 'Node'
  host: 'localhost',
  port: 23053
});

notifier.notify({
  title: 'Foo',
  message: 'Hello World',
  icon: fs.readFileSync(__dirname + '/coulson.jpg'),
  wait: false, // Wait for User Action against Notification

  // and other growl options like sticky etc.
  sticky: false,
  label: undefined,
  priority: undefined
});
```

See more information about using [growly](https://github.com/theabraham/growly/).

### Usage: `WindowsBalloon`

For earlier versions of Windows, taskbar balloons are used (unless
fallback is activated and Growl is running). The balloons notifier uses a great
project called [**`notifu`**](http://www.paralint.com/projects/notifu/).

```javascript
const WindowsBalloon = require('node-notifier-v2').WindowsBalloon;

var notifier = new WindowsBalloon({
  withFallback: false, // Try Windows Toast and Growl first?
  customPath: undefined // Relative/Absolute path if you want to use your fork of notifu
});

notifier.notify(
  {
    title: undefined,
    message: undefined,
    sound: false, // true | false.
    time: 5000, // How long to show balloon in ms
    wait: false, // Wait for User Action against Notification
    type: 'info' // The notification type : info | warn | error
  },
  function (error, response) {
    console.log(response);
  }
);
```

See full usage on the [project homepage: **`notifu`**](http://www.paralint.com/projects/notifu/).

### Usage: `NotifySend`

**Note:** `notify-send` doesn't support the `wait` flag.

```javascript
const NotifySend = require('node-notifier-v2').NotifySend;

var notifier = new NotifySend();

notifier.notify({
  title: 'Foo',
  message: 'Hello World',
  icon: __dirname + '/coulson.jpg',

  wait: false, // Defaults no expire time set. If true expire time of 5 seconds is used
  timeout: 10, // Alias for expire-time, time etc. Time before notify-send expires. Defaults to 10 seconds.

  // .. and other notify-send flags:
  'app-name': 'node-notifier',
  urgency: undefined,
  category: undefined,
  hint: undefined
});
```

See flags and options on the man page [`notify-send(1)`](http://manpages.ubuntu.com/manpages/gutsy/man1/notify-send.1.html)

## Thanks to OSS

`node-notifier-v2` is made possible through Open Source Software.
A very special thanks to all the modules `node-notifier-v2` uses.

- [`terminal-notifier`](https://github.com/julienXX/terminal-notifier)
- [`Alerter`](https://github.com/vjeantet/alerter)
- [`Snoretoast`](https://github.com/KDE/snoretoast/releases/tag/v0.7.0)
- [`notifu`](http://www.paralint.com/projects/notifu/)
- [`growly`](https://github.com/theabraham/growly/)

[![NPM downloads][npm-downloads]][npm-url]

## Common Issues

### How to use SnoreToast with both appID and actions

[See this issue by Araxeus](https://github.com/mikaelbr/node-notifier/issues/424).

### Windows: `SnoreToast` text

See note on "Windows 10 Fall Creators Update" in Windows section.
_**Short answer:** update your `appID`._

### Windows and WSL2

If you don't see notifications within WSL2, you might have to change permission of exe vendor files (snoreToast).
[See issue for more info](https://github.com/mikaelbr/node-notifier/issues/353)

### Use inside tmux session

When using `node-notifier-v2` within a tmux session, it can cause a hang in the system.
This can be solved by following the steps described in [this comment](https://github.com/julienXX/terminal-notifier/issues/115#issuecomment-104214742)

There’s even more info [here](https://github.com/mikaelbr/node-notifier/issues/61#issuecomment-163560801)
<https://github.com/mikaelbr/node-notifier/issues/61#issuecomment-163560801>.

### macOS: Missing notifications or custom icons

Allow notifications for the sender in System Settings → Notifications and check
Focus settings. Alerter defaults to the Terminal sender. Custom icons and
attached images use private macOS APIs and may not work on every OS release.
The `osascript` fallback does not support custom icons or interactions.

### Within Electron Packaging

If packaging your Electron app as an `asar`, you will find `node-notifier-v2` will fail to load.

Due to the way asar works, you cannot execute a binary from within an `asar`.
As a simple solution, when packaging the app into an asar please make sure you
`--unpack` the `vendor/` folder of `node-notifier-v2`, so the module still has access to
the notification binaries.

You can do so with the following command:

```bash
asar pack . app.asar --unpack "./node_modules/node-notifier-v2/vendor/**"
```

Or if you use `electron-builder` without using asar directly, append `build` object to your `package.json` as below:

```bash
...
build: {
  asarUnpack: [
    './node_modules/node-notifier-v2/**/*',
  ]
},
...
```

### Using with pkg

For issues using with the pkg module. Check this issue out: https://github.com/mikaelbr/node-notifier/issues/220#issuecomment-425963752

### Using Webpack

When using `node-notifier-v2` inside of `webpack`, you must add the snippet below to your `webpack.config.js`.

This is necessary because `node-notifier-v2` loads the notifiers from a binary, so it
needs a relative file path. When webpack compiles the modules, it suppresses file
directories, causing `node-notifier-v2` to error on certain platforms.

To fix this, you can configure webpack to keep the relative file directories.
Do so by append the following code to your `webpack.config.js`:

```javascript
node: {
  __filename: true,
  __dirname: true
}
```

## License

This package is licensed using the [MIT License](http://en.wikipedia.org/wiki/MIT_License).

[SnoreToast](https://raw.githubusercontent.com/mikaelbr/node-notifier/master/vendor/snoreToast/LICENSE) and [Notifu](https://raw.githubusercontent.com/mikaelbr/node-notifier/master/vendor/notifu/LICENSE) have licenses in their vendored versions which do not match the MIT license, LGPL-3 and BSD 3-Clause to be specific. We are not lawyers, but have made our best efforts to conform to the terms in those licenses while releasing this package using the license we chose.

[npm-url]: https://npmjs.org/package/node-notifier-v2
[npm-image]: http://img.shields.io/npm/v/node-notifier-v2.svg?style=flat
[size-url]: https://packagephobia.com/result?p=node-notifier-v2
[size-image]: https://packagephobia.com/badge?p=node-notifier-v2
[npm-downloads]: http://img.shields.io/npm/dm/node-notifier-v2.svg?style=flat
[travis-url]: http://travis-ci.org/mikaelbr/node-notifier
[travis-image]: http://img.shields.io/travis/mikaelbr/node-notifier.svg?style=flat
