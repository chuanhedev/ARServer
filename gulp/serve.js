const gulp = require("gulp");
const argv = require("yargs").argv;
const browserSync = require('browser-sync').create();
const builder = require("./build");
const nodePath = require("path");

function parseGameId(path) {
  let segments = path.split(nodePath.sep);
  if (segments.length > 0 && segments[0] === "games") {
    return segments[1];
  }
  return undefined;
}

gulp.task("serve2", function () {
  let gameId = argv.id;
  let gamePath =  "games/" + gameId + "/";
  let commonPath =  "games/_commons/";
  browserSync.init({
    server: {
      baseDir: "./"
    }
  });

  gulp.watch([gamePath + "**/layout/**.xml", commonPath + "**/layout/**.xml", "!" + gamePath + "**/layout/**.min.xml"]).on("change", path => {
    if (gameId) {
      builder.processLayout(gameId).then(() => {
        browserSync.reload();
      });
    }
  });

  gulp.watch([
    gamePath + "**/index.html",
    gamePath + "**/css/*.css",
    gamePath + "**/js/app.js",
    gamePath + "**/assets/*.png",
    gamePath + "**/assets/*.jpg"
  ]).on("change", () => browserSync.reload());

});

module.exports = {
  serve: gulp.series("serve2"),
}