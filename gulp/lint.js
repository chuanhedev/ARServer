const gulp = require("gulp");
const tslint = require("gulp-tslint");

gulp.task("lint", function () {
  return gulp.src([
    "engine/src/**/**.ts",
    "games/**/**.ts",
    "tests/**/**.ts"
  ])
    .pipe(tslint({
      formatter: "verbose"
    }))
    .pipe(tslint.report());
});