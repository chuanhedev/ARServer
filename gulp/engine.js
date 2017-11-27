const gulp = require("gulp");
const argv = require("yargs").argv;
const fsp = require('fs-promise');
const fs = require("fs");
const del = require('del');
const logger = require("./logger");
const helper = require("./helper");
const path = require('path');
const git = require('gulp-git');

function engineUpdate() {
  let enginePath = path.join(helper.getEnginePath(argv.id));
  let version = argv.v;
  let _promise;
  if (!version)
    throw Error("please state your version by -v='version'");
  git.checkout("tags/v" + version, {
    cwd: enginePath
  }, function (err) {
    if (err) {
      throw err;
    } else {
      let p = path.join(helper.getGamePath(argv.id), 'config.json');
      let config = JSON.parse(fs.readFileSync(p, "utf8"));
      config.engine = version;
      fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
      _resolve();
    }
  });
  return new Promise(resolve => _resolve = resolve);
}

module.exports = {
  engineUpdate: engineUpdate
}