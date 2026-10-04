const notifier = require('../index');

notifier
  .notify({ message: 'Hello', wait: true }, function (err, data) {
    // macOS reports script completion; other backends may wait for interaction.
    console.log('Notification backend completed');
    console.log(err, data);
  })
  .on('click', function () {
    console.log(arguments);
  });
