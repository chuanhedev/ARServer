const argv = require("yargs").argv;
const image = require('gulp-image');
const gulp = require("gulp");
const helper = require("./helper");
const logger = require("./logger");
const del = require('del');

gulp.task("image2", function () {
  var gamePath = helper.getGamePath(argv.id);
  var gameReleasePath = helper.getGameReleasePath(argv);
  var gameReleaseBinPath = helper.getGameReleaseBinPath(argv);
  // if (argv.wi)
  return gulp.src(gameReleaseBinPath + "/assets{,/**}")
    .pipe(gulp.dest(gameReleasePath));
  // else
  //   return compressImage([gamePath + "/assets/**/*{.png,.jpg}", "!" + gamePath + "/assets/resources{,/**}"], gameReleasePath + "/assets");
});

gulp.task("imageonly", function () {
  if (argv.wi)
    return Promise.resolve();
  var gamePath = helper.getGamePath(argv.id);
  var gameReleaseBinPath = helper.getGameReleaseBinPath(argv);
  return del(gameReleaseBinPath + "/assets").then(() =>
    compressImage([gamePath + "/assets/**/*{.png,.jpg}", "!" + gamePath + "/assets/resources{,/**}"], gameReleaseBinPath + "/assets")
  )
});

function compressImage(src, des) {
  return new Promise(function (resolve, reject) {
    gulp.src(src)
      .pipe(image({
        pngquant: true,
        optipng: false,
        zopflipng: false,
        jpegRecompress: false,
        jpegoptim: false,
        mozjpeg: false,
        gifsicle: true,
        svgo: true
      }))
      .pipe(gulp.dest(des))
      .on('end', resolve);
  });
}

module.exports = {
  image: gulp.series("image2"),
  compressImage: compressImage
}