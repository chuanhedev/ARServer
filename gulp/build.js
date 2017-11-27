const gulp = require("gulp");
const argv = require("yargs").argv;
const gutil = require('gulp-util');
const fsp = require('fs-promise');
const fs = require("fs");
const webpack = require("webpack");
const webpackStream = require('webpack-stream');
const tslint = require("gulp-tslint");
const audiosprite = require('gulp-audiosprite');
const browserSync = require('browser-sync').create();
const del = require('del');
const replace = require('gulp-replace');
const rename = require("gulp-rename");
const logger = require("./logger");
const helper = require("./helper");
const layoutPreprocessor = require("./layoutPreprocessor");
const path = require('path');
const file = require('./file');
const image = require("./image");
const libxml = require("libxmljs");

let publish = false;
let libFiles; // = ["Tween.js", "aes.js", "decimal.min.js", "es6-promise.min.js", "howler.min.js", "pixi.min.js", "is.min.js", "bootstrap.js", "slot.css"];
let timeStamp;
let config;

function getTimeStamp() {
  if (!timeStamp)
    timeStamp = Date.now();
  return timeStamp;
}

function processLayout(gameId) {
  let gameConfig = helper.loadConfig(gameId);
  let gameFolder = helper.getGamePath(gameId);
  let environment = helper.getEnvironment(argv);
  let defaultDeploy = gameConfig.deployment.default;
  validateEngine(gameConfig);
  for (var key in gameConfig.deployment) {
    if (key !== "default") {
      gameConfig.deployment[key] = helper.merge(gameConfig.deployment[key], defaultDeploy);
      gameConfig.deployment[key].engineVersion = gameConfig.engine;
      gameConfig.deployment[key].publishTime = getTimeStamp();
    }
  }
  delete gameConfig.deployment.default;
  config = gameConfig;
  return layoutPreprocessor.process(gameConfig, {
    workdir: gameFolder + "/layout",
    target: (publish ? environment : "dev")
  });
}

function getEnvironment() {
  let environment = helper.getEnvironment(argv);
  return publish ? environment : "uat";
}

function buildOne() {
  let gameId = argv.id;
  let gameFolder = helper.getGamePath(gameId);
  let promise = processLayout(gameId);
  for (let i = 0; i < config.platform.length; i++) {
    let pfname = config.platform[i];
    promise = promise.then(() => helper.makeWebpackConfig(gameId, publish, pfname))
      .then(config => new Promise((resolve, reject) => {
        gulp.src(gameFolder + `/src/app.${pfname}.ts`)
          .pipe(webpackStream(config))
          .pipe(gulp.dest(gameFolder + "/js/"))
          .on("end", resolve());
      }));
  }
  return promise;
}

gulp.task("processLayout", () => processLayout(argv.id));

gulp.task("copyToRelease", function () {
  var gameFolder = helper.getGamePath(argv.id);
  var gameReleasePath = helper.getGameReleasePath(argv);

  gulp.src([gameFolder + "/layout/**/*.min.xml"])
    .pipe(gulp.dest(gameReleasePath + "/layout"));
  return gulp.src([gameFolder + "/**",
      "!" + gameFolder + "/layout/**",
      "!" + gameFolder + "/config.json",
      "!" + gameFolder + "/engine{,/**}",
      "!" + gameFolder + "/server{,/**}",
      "!" + gameFolder + "/assets/resources{,/**}"
    ])
    .pipe(gulp.dest(gameReleasePath));
});

gulp.task("clearRelease", function () {
  var gameReleasePath = helper.getGameReleasePath(argv);
  publish = true;
  return del(gameReleasePath);
});

gulp.task("cleanRelease", function () {
  var gameReleasePath = helper.getGameReleasePath(argv);
  return del(gameReleasePath + "{/tsconfig.json,/bin,/src}");
});

gulp.task("modifyJsVersion", function () {
  var gameReleasePath = helper.getGameReleasePath(argv);
  let p = path.join(gameReleasePath, 'lib', 'bootstrap.js');
  try {
    let js = fs.readFileSync(p, "utf8");
    if (js) {
      js = js.replace(/jsversion"/g, getTimeStamp() + '"');
      fs.writeFileSync(p, js, "utf8");
    }
  } catch (e) {}
  return Promise.resolve();
});

gulp.task("modifyAppInsights", function () {
  var gameReleasePath = helper.getGameReleasePath(argv);
  let p = path.join(gameReleasePath, 'lib', 'appinsights.js');
  try {
    let js = fs.readFileSync(p, "utf8");
    if (js && getEnvironment() === "prod") {
      let gameConfig = helper.loadConfig(argv.id);
      console.log('reaplce', gameConfig.uatInsightToken, 'to', gameConfig.prodInsightToken);
      js = js.replace(gameConfig.uatInsightToken, gameConfig.prodInsightToken);
      fs.writeFileSync(p, js, "utf8");
    }
  } catch (e) {}
  return Promise.resolve();
});

gulp.task("copyPlugins", function () {
  //var vendorPath = "./node_modules/";
  var gamePath = helper.getGamePath(argv.id);
  var gameReleasePath = helper.getGameReleasePath(argv);
  let libs = libFiles.map(x => gamePath + "/engine/lib/" + x);
  return gulp.src(libs)
    .pipe(gulp.dest(gameReleasePath + "/lib"));
});

gulp.task("modifyRelease", function () {
  var gamePath = helper.getGamePath(argv.id);
  var gameReleasePath = helper.getGameReleasePath(argv);
  let indexhtml = fs.readFileSync(path.join(gamePath, "index.html"), "utf8");
  let libpath = "./engine/lib/"
  let startidx = 0;
  libFiles = []
  while (startidx > -1) {
    startidx = indexhtml.indexOf(libpath, startidx);
    if (startidx > -1) {
      let endidx = indexhtml.indexOf('"', startidx + 1);
      let plugin = indexhtml.substr(startidx + libpath.length, endidx - startidx - libpath.length);
      startidx = endidx;
      libFiles.push(plugin);
    }
  }

  //find "./engine/lib/slot.css"
  var matches = indexhtml.match(/"\.\/engine\/lib\/\w+\.(js|css)"/g);
  for (let i = 0; i < matches.length; i++) {
    let match = matches[i]
    console.log('applying time stamp ', match)
    indexhtml = indexhtml.replace(match, '".' + match.substr(9, match.length - 10) + '?v=' + getTimeStamp() + '"');
  }
  // indexhtml = indexhtml.replace('lib/bootstrap.js"', 'lib/bootstrap.js?v=' + getTimeStamp() + '"');
  // indexhtml = indexhtml.replace('lib/slot.css"', 'lib/slot.css?v=' + getTimeStamp() + '"');
  indexhtml = indexhtml.replace(/.\/engine\//g, './');
  fs.writeFileSync(path.join(gameReleasePath, 'index.html'), indexhtml, "utf8");
  return Promise.resolve();
});

gulp.task("buildOnly", cb => {
  if (argv.id) {
    return buildOne(argv.id).then(cb);
  } else {
    fsp.readdir("./games")
      .then(dirs => dirs.filter(dir => !dir.startsWith(".")))
      .then(dirs => dirs.map(buildOne))
      .then(Promise.all)
      .then(cb);
  }
});

gulp.task("common2", cb => {
  let commonPath = helper.getCommonPath();
  return del(path.join(commonPath, 'bin'))
    .then(() => {
      gulp.src([commonPath + "{gametitle,text,freeround,lib}{,/**}", "!**/resources{,/**}"])
        .pipe(gulp.dest(path.join(commonPath, 'bin')));
    })
});

gulp.task("commonFont", () => {
  let commonPath = helper.getCommonPath();
  return image.compressImage([
      commonPath + "font/**", "!" + commonPath + "font/resources{,/**}"
    ],
    path.join(commonPath, 'bin/font'));
});

gulp.task("commonUi", () => compressCommonImage('ui'));

gulp.task("commonBonusbet", () => compressCommonImage('bonusbet'));

function compressCommonImage(folder) {
  let commonPath = helper.getCommonPath();
  return image.compressImage([
      commonPath + folder + "/**", "!" + commonPath + folder + "/**/resources{,/**}"
    ],
    path.join(commonPath, 'bin/' + folder));
}

gulp.task("versionGame", () => {
  applyVersion(helper.getGameReleasePath(argv));
  return Promise.resolve();
});

gulp.task("versionCommon", () => {
  applyVersion(path.join(helper.getCommonPath(), 'bin'));
  return Promise.resolve();
});

function applyVersion(path) {
  file.forEachFile(path, (file) => {
    let data = JSON.parse(fs.readFileSync(file, "utf8"));
    let changed = false;
    //sheet
    if (data.meta && data.meta.image) {
      data.meta.image = appendVersion(data.meta.image);
      changed = true;
    }
    // sound sprite
    else if (data.src && data.sprite) {
      for (let i = 0; i < data.src.length; i++)
        data.src[i] = appendVersion(data.src[i]);
      changed = true;
    }
    if (changed) {
      console.log(file, ": version is added.");
      fs.writeFileSync(file, JSON.stringify(data), "utf8");
    }
  }, ".json");

  file.forEachFile(path, (file) => {
    let data = libxml.parseXmlString(fs.readFileSync(file, "utf8"));
    let pages = data.find("/font/pages");
    if (pages.length > 0) {
      console.log(file, ": version is added.");
      pages[0].childNodes().forEach(x => {
        if (x.type() === "element") {
          let value = x.attr("file").value();
          x.attr("file").value(appendVersion(value));
        }
      });
      fs.writeFileSync(file, data.toString(), "utf8");
    }

  }, ".xml");
}

function appendVersion(str) {
  return str + "?v=" + getTimeStamp();
}


function validateEngine(gameConfig) {
  let engineInfo = JSON.parse(fs.readFileSync(path.join(helper.getEnginePath(argv.id), "package.json"), "utf8"));
  let publishVersion = gameConfig.engine;
  if (engineInfo.version !== publishVersion) {
    throw Error("Your target publish engine version and current engine version doesnot match. \n" +
      "please run 'gulp engineupdate --id=" + argv.id + " -v=" + publishVersion + "' to update your engine.");
  }
}
//gulp.task("build2", gulp.series("buildOnly"));
//gulp.task("publish2", gulp.series("clearRelease", "buildOnly", "copyToRelease", "image", "modifyRelease", "copyPlugins", "cleanRelease"));

module.exports = {
  processLayout: processLayout,
  build: gulp.series("buildOnly"),
  common: gulp.series("common2", "commonFont", "commonUi", "commonBonusbet", "versionCommon"),
  versionJson: gulp.series("versionGame"),
  publish: gulp.series("clearRelease", "buildOnly", "copyToRelease", "imageonly", "image", "modifyRelease", "copyPlugins", "modifyAppInsights", "modifyJsVersion", "cleanRelease", "versionGame")
}