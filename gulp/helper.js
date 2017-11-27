let argv = require("yargs");
let fs = require("fs");
let fsp = require('fs-promise');
let toml = require('toml-js');
let webpack = require("webpack");
const libxml = require("libxmljs");



const templateFolder = "./templates/";
const gamesFolder = "./games/";
const commonFolder = "./games/_commons/";

function getGameConfigPath(gameId) {
  return getGamePath(gameId) + "/config.json";
}

function getGamePath(gameId) {
  return gamesFolder + gameId;
}

function getEnginePath(gameId) {
  return getGamePath(gameId) + "/engine";
}

function getCommonPath() {
  return commonFolder;
}

function getGameReleaseBinPath(argv) {
  let gameId = argv.id;
  return gamesFolder + gameId + "/bin";
}

function getGameReleasePath(argv) {
  let gameId = argv.id;
  return gamesFolder + gameId + "/bin/" + getEnvironment(argv);
}

function getEnvironment(argv) {
  let target = argv.t || argv.target;
  if (target === undefined)
    target = "uat";
  else if (["uat", "staging", "prod"].indexOf(target) === -1)
    console.warn("target platform -t=" + target);
  return target;
}

function loadConfig(gameId) {
  let commonConfig = JSON.parse(fs.readFileSync(getCommonPath() + "config.json", "utf8"));
  let gameConfig = JSON.parse(fs.readFileSync(getGamePath(gameId) + "/config.json", "utf8"));
  return merge(gameConfig, commonConfig);
}

function merge(from, to) {
  return mergeTo(from, cloneJson(to));
}

function mergeTo(from, to) {
  for (let key in from) {
    if (to[key] === undefined) {
      to[key] = from[key];
    } else {
      if (to[key].constructor.name == "Object" && from[key].constructor.name == "Object")
        mergeTo(from[key], to[key]);
      else
        to[key] = from[key];
    }
  }
  return to;
}

function getAttrsObject(node) {
  let attrs = {};
  node.attrs().forEach(attr => {
    attrs[attr.name()] = attr.value();
  });
  return attrs;
}

function replaceKeys(node, context) {
  let str = node.toString();
  for (let key in context) {
    str = str.replace(new RegExp("{%" + key + "%}", 'g'), context[key]);
  }
  return libxml.parseXmlString(str).root();
}

function cloneJson(json) {
  return JSON.parse(JSON.stringify(json));
}

function makeWebpackConfig(gameId, release, platform) {
  platform = platform ? "." + platform : "";
  return new Promise((resolve, reject) => {
    let gameFolder = getGamePath(gameId);
    if (!fsp.existsSync(gameFolder)) {
      reject(gameFolder + " is not existing!");
    } else {
      let config = {
        entry: gameFolder + "/src/app" + platform + ".ts",
        output: {
          filename: "app" + platform + ".js",
        },
        resolve: {
          extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
        },
        module: {
          loaders: [{
            test: /\.tsx?$/,
            loader: "ts-loader"
          }]
        }
      };

      if (release) {
        config.plugins = [
          new webpack.optimize.UglifyJsPlugin({
            compress: {
              warnings: true,
            },
            output: {
              comments: false,
            },
            mangle: true
          }),
          new webpack.optimize.DedupePlugin()
        ];
      } else {
        config.devtool = "source-map";
      }
      resolve(config);
    }
  });
}

module.exports = {
  loadConfig: loadConfig,
  merge: merge,
  makeWebpackConfig: makeWebpackConfig,
  templateFolder: templateFolder,
  gamesFolder: gamesFolder,
  getGamePath: getGamePath,
  getCommonPath: getCommonPath,
  getGameReleaseBinPath: getGameReleaseBinPath,
  getGameReleasePath: getGameReleasePath,
  getEnvironment: getEnvironment,
  getAttrsObject: getAttrsObject,
  replaceKeys: replaceKeys,
  mergeTo: mergeTo,
  getEnginePath: getEnginePath
};