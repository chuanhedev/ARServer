const argv = require("yargs").argv;
const fsp = require('fs-promise');
const gulp = require("gulp");
const helper = require("./helper");
const logger = require("./logger");


function replaceKeys(file, keys, values) {
  if (!fsp.existsSync(file)) {
    return Promise.resolve();
  }
  return fsp.readFile(file, "utf8")
    .then(function (data) {
      let tasks = [];
      for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        let v = values[i];
        data = data.replace(k, v);
      }
      return fsp.writeFile(file, data, "utf8").catch(function (err) {
        logger.error("encountered error during write file " + file);
      });
    })
    .catch(function (err) {
      logger.error(err);
    });
}

gulp.task("create", function (cb) {
  let gameId = argv.id;
  let templateName = argv.tmpl || "default";
  let targetFolder = helper.gamesFolder + gameId;
  if (fsp.existsSync(targetFolder)) {
    logger.error("Game id (" + gameId + ") already be used, please use another one!!");
    return;
  }

  let sourceFolder = helper.templateFolder + templateName;

  let keys = [/{{GAME_ID}}/g];
  let values = [gameId];
  let files = [targetFolder + "/src/app.ts",
    targetFolder + "/bin/index.html",
    targetFolder + "/layout/mobile.xml"
  ];

  fsp.copy(sourceFolder, targetFolder)
    .then(() => Promise.all(files.map(filename => replaceKeys(filename, keys, values))))
    .then(() => logger.success("Create game '" + gameId + "' done, saved in '" + targetFolder + "'"))
    .then(cb)
    .catch(logger.error);
});