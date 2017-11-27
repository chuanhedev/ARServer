var exec = require('child_process').exec;
//var spawn = require('child_process').spawn;
const gulp = require("gulp");
const argv = require("yargs").argv;

gulp.task("publishall", function () {
  let gameId = argv.id;
  return execPromise(`gulp imageonly --id=${gameId};gulp publish --wi --id=${gameId};gulp publish --wi --id=${gameId} -t=staging;gulp publish --wi --id=${gameId} -t=prod`)
});

gulp.task("uploadall", function () {
  let gameId = argv.id;
  let options = (argv.web ? ' --web' : '') + (argv.mobile ? ' --mobile' : '');
  return execPromise(`gulp imageonly --id=${gameId};gulp upload --wi --id=${gameId}${options};gulp upload --wi --id=${gameId}${options} -t=staging;gulp upload --wi --id=${gameId}${options} -t=prod`)
});


function execPromise(cmd) {
  if (!cmd) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let process = exec(cmd, function (err, stdout, stderr) {
      resolve();
    });

    process.stdout.on('data', function (data) {
      console.log(data.toString().trim());
    });

    process.stderr.on('data', function (data) {
      console.error(data.toString().trim());
    });
  })
}

module.exports = {
  execute: execPromise,
}