const gulp = require("gulp");
const argv = require("yargs").argv;
const fsp = require('fs-promise');
const audiosprite = require('gulp-audiosprite');
const helper = require("./helper");
const logger = require("./logger");
const fs = require("fs");
const path = require('path');

function isDirectory(path) {
  return fs.lstatSync(path).isDirectory()
}

function forEachFile(dir, func, extension = "") {
  fs.readdir(dir, (err, files) => {
    if (files) {
      files.forEach(file => {
        let p = path.join(dir, file);
        if (isDirectory(p))
          forEachFile(p, func, extension);
        else if (!extension || p.endsWith(extension))
          func(p);
      });
    }
  })
}


module.exports = {
  isDirectory: isDirectory,
  forEachFile: forEachFile
}