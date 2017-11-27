let gutil = require('gulp-util');

let logger = {
  write: function (decorator, msg) {
    gutil.log(decorator(msg));
  },
  error: function (msg) {
    this.write(gutil.colors.red.bold, msg);
  },
  warn: function (msg) {
    this.write(gutil.colors.yellow.bold, msg);
  },
  success: function (msg) {
    this.write(gutil.colors.green.bold, msg);
  }
};

module.exports = logger;