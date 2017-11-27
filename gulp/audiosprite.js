const gulp = require("gulp");
const argv = require("yargs").argv;
const fsp = require('fs-promise');
const audiosprite = require('gulp-audiosprite');
const helper = require("./helper");
const logger = require("./logger");
const path = require('path');
const fs = require("fs");

function generateAudio(input, output, file) {
  console.log(input);
  if (!fsp.existsSync(input)) {
    logger.error(input + " is not existing!");
    return;
  }
  return gulp.src(input + "/*.*")
    .pipe(audiosprite({
      format: "howler",
      output: file,
      bitrate: 32
    }))
    .pipe(gulp.dest(output))
    .on("end", function () {
      logger.success("generated audio sprite at " + output);
    });
}

function parseJson(src, prefix, loopSounds = []) {
  let data = JSON.parse(fs.readFileSync(src, "utf8"));
  data.src = data.urls;
  delete data.urls;
  for (let i = 0; i < data.src.length; i++) {
    data.src[i] = prefix + data.src[i];
  }
  for (var key in data.sprite) {
    if (key.indexOf('bgm') > -1 || loopSounds.indexOf(key) > -1) {
      data.sprite[key].push(true);
    }
  }
  console.log(data);
  fs.writeFileSync(src, JSON.stringify(data), "utf8");
  return Promise.resolve();
}

gulp.task("convertspin", function () {
  let gamepath = helper.getGamePath(argv.id);
  return gulp.src(gamepath + "/assets/resources/sounds/spin.mp3")
    .pipe(audiosprite({
      format: "howler",
      output: "spin",
      bitrate: 32
    }))
    .pipe(gulp.dest(gamepath + "/assets"))
    .on("end", function () {
      fs.unlinkSync(gamepath + "/assets/spin.json");
    });
});


gulp.task("audiosprite2", function () {
  if (argv.t === "wheel")
    return generateAudio(helper.getCommonPath() + "bonusbet/resources/wheelsound",
      helper.getCommonPath() + "bonusbet/", "wheel");
  else if (argv.t === "pick")
    return generateAudio(helper.getCommonPath() + "bonusbet/resources/picksound",
      helper.getCommonPath() + "bonusbet/", "pick");
  else
    return generateAudio(helper.getGamePath(argv.id) + "/assets/resources/sounds",
      helper.getGamePath(argv.id) + "/assets/", "sounds");
});


gulp.task("parseJson", function () {
  if (argv.t === "wheel")
    return parseJson(helper.getCommonPath() + "bonusbet/wheel.json", "../_commons/bonusbet/", ["wheelspin"]);
  else if (argv.t === "pick")
    return parseJson(helper.getCommonPath() + "bonusbet/pick.json", "../_commons/bonusbet/");
  else
    return parseJson(helper.getGamePath(argv.id) + "/assets/sounds.json", "assets/");
});

module.exports = {
  audiosprite: gulp.series("audiosprite2", "parseJson", "convertspin"),
}