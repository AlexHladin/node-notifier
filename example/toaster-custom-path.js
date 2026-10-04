const { WindowsToaster } = require('../');
const path = require('path');

const resourceDir = path.join(
  process.pkg ? path.dirname(process.execPath) : __dirname,
  'resources'
);
const customPath = path.join(resourceDir, 'snoretoast-x64.exe');
const notifierOptions = { withFallback: false, customPath };
const notifier = new WindowsToaster(notifierOptions);

notifier.notify(
  {
    message: 'Hello!',
    icon: path.join(resourceDir, 'coulson.jpg'),
    sound: true
  },
  function(err, data) {
    // Will also wait until notification is closed.
    console.log('Waited');
    console.log(JSON.stringify({ err, data }));
  }
);

notifier.on('timeout', () => {
  console.log('Timed out!');
});

notifier.on('click', () => {
  console.log('Clicked!');
});
