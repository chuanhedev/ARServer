//var remoteMobileRoot;
//var clientDir;
var deploymentEnv;
var fs = require('fs');
var PATH = require('path');
var md5 = require('md5');
var sftp;
var Client = require('ssh2').Client;
const logFileName = '.log';
const helper = require("./helper");
const gulp = require("gulp");
const argv = require("yargs").argv;
var serverConfig;
var gameAlias;
var md5Obj = {};


// gulp.task("uploadonly", function () {
//   let gameId = argv.id;
//   let gulpPath = PATH.join(helper.getEnginePath(gameId), 'gulp');
//   serverConfig = JSON.parse(fs.readFileSync(PATH.join(gulpPath, 'server.json')));
//   let clientConfig = JSON.parse(fs.readFileSync(PATH.join(helper.getCommonPath(), 'client.json')));
//   deploymentEnv = helper.getEnvironment(argv);
//   clientConfig = clientConfig[deploymentEnv];
//   gameAlias = serverConfig.gameIDAlias;
//   serverConfig = serverConfig[deploymentEnv];
//   //remoteMobileRoot = serverConfig.root;
//   let connectConfig = {
//     host: serverConfig.host,
//     port: 22,
//     username: clientConfig.username,
//     password: clientConfig.password,
//     //debug: log,
//     algorithms: {
//       serverHostKey: ['ssh-rsa', 'ssh-dss'],
//     }
//   }
//   return uploadGame(connectConfig).then(() => console.log('done'));
// });


gulp.task("uploadonly", function () {
  let config = loadConfig();
  let from = PATH.join(helper.getGameReleasePath(argv), '');
  let gameid = gameAlias[argv.id] || argv.id;
  let tos = [];
  if (argv.web && argv.mobile) {
    tos.push(PATH.join(serverConfig['web'], gameid));
    tos.push(PATH.join(serverConfig['mobile'], gameid));
  } else if (argv.web) {
    tos.push(PATH.join(serverConfig['web'], gameid));
  } else {
    tos.push(PATH.join(serverConfig['mobile'], gameid));
  }
  console.log(from, tos);
  return uploadFolders(from, tos, config);
});

gulp.task("uploadcommon", function () {
  let config = loadConfig();
  let from = PATH.join(helper.getCommonPath(), 'bin');
  let tos = [];
  if (argv.web && argv.mobile) {
    tos.push(PATH.join(serverConfig['web'], '_commons'));
    tos.push(PATH.join(serverConfig['mobile'], '_commons'));
  } else if (argv.web) {
    tos.push(PATH.join(serverConfig['web'], '_commons'));
  } else {
    tos.push(PATH.join(serverConfig['mobile'], '_commons'));
  }
  console.log(from, tos);
  return uploadFolders(from, tos, config);
});

function loadConfig() {
  let gameId = argv.id;
  let gulpPath = PATH.join(helper.getEnginePath(gameId), 'gulp');
  serverConfig = JSON.parse(fs.readFileSync(PATH.join(gulpPath, 'server.json')));
  let clientConfig = JSON.parse(fs.readFileSync(PATH.join(helper.getCommonPath(), 'client.json')));
  deploymentEnv = helper.getEnvironment(argv);
  clientConfig = clientConfig[deploymentEnv];
  gameAlias = serverConfig.gameIDAlias;
  serverConfig = serverConfig[deploymentEnv];
  //remoteMobileRoot = serverConfig.root;
  let connectConfig = {
    host: serverConfig.host,
    port: 22,
    username: clientConfig.username,
    password: clientConfig.password,
    //debug: log,
    algorithms: {
      serverHostKey: ['ssh-rsa', 'ssh-dss'],
    }
  }
  return connectConfig;
}

function uploadFolders(from, tos, config) {
  let _resolve;
  var conn = new Client();
  console.log('connecting to ', config.host, ' ...');
  conn.on('ready', function () {
    console.log('connected ', config.host);
    conn.sftp(function (err, _sftp) {
      if (err) throw err;
      sftp = _sftp;
      //console.log(remoteMobileRoot, gameID);
      let clientLogPath = PATH.join(PATH.dirname(from), logFileName);
      md5Obj = {};
      loopDir(from, from, md5Obj);
      md5Obj = normaliseMd5Log(md5Obj);
      fs.writeFileSync(clientLogPath, JSON.stringify(md5Obj), 'utf8');
      let promise = Promise.resolve();
      if (tos.constructor !== Array) tos = [tos];
      for (let i = 0; i < tos.length; i++)
        promise = promise.then(() => uploadFolder(from, tos[i], clientLogPath));
      promise.then(() => {
        fs.unlinkSync(clientLogPath);
        conn.end();
        conn.destroy();
        _resolve();
      });
    });
  }).connect(config);
  return new Promise((resolve, reject) => {
    _resolve = resolve;
  })
}

function normaliseMd5Log(json) {
  let newobj = {}
  for (let key in json) {
    //console.log(key, key.replace(new RegExp('\\', 'g'), '/'));
    newobj[key.replace(/\\/g, "/")] = json[key];
  }
  return newobj;
}

function uploadFolder(from, to, logPath) {
  let remoteLogPath = PATH.join(to, logFileName);
  let remoteMd5;
  console.log('uploading from "', from, '" to "', to, '"');
  return read(remoteLogPath)
    .then((json) => {
      let promise = Promise.resolve();
      remoteMd5 = json ? JSON.parse(json) : {};
      remoteMd5 = normaliseMd5Log(remoteMd5);
      let uploadingPaths = [];
      for (let key in md5Obj) {
        if (remoteMd5[key] !== md5Obj[key]) {
          uploadingPaths.push(key);
        }
      }
      if (argv.filter === 'js') {
        uploadingPaths = applyPathFilter(uploadingPaths, [/lib\/.+/, /js\/.+/, /.+bootstrap\.js/, /index\.html/]);
      }
      // else if (argv.filter === 'image') {
      //   uploadingPaths = applyPathFilter(uploadingPaths, [/.+\.png/i, /.+\.jpg/i, /.+\.jpeg/i]);
      // }
      for (let i = 0; i < uploadingPaths.length; i++) {
        let path = uploadingPaths[i];
        promise = promise.then(() => upload(PATH.join(from, path), PATH.join(to, path)));
      }
      return promise;
    })
    .then(() => {
      if (argv.filter) return Promise.resolve();
      let promise = Promise.resolve();
      for (let key in remoteMd5) {
        if (md5Obj[key] === undefined) {
          log('delete ', key);
          promise = promise.then(() => unlink(PATH.join(to, key)));
        }
      }
      return promise;
    })
    .then(() => {
      if (argv.filter) return Promise.resolve();
      return upload(logPath, remoteLogPath);
    })
}

//the order of the filters matters
//the paths matches the first element of filters always upload first
function applyPathFilter(paths, filters) {
  if (filters === undefined || filters.length === 0) return paths;
  let res = [];
  let orderedRes = [];
  for (let i = 0; i < filters.length; i++)
    orderedRes.push([]);
  for (let i = 0; i < paths.length; i++) {
    let path = paths[i];
    console.log('checking.. ', path);
    for (let j = filters.length - 1; j > -1; j--) {
      if (path.match(filters[j])) {
        orderedRes[j].push(path);
        break;
      }
    }
  }
  for (let i = 0; i < filters.length; i++) {
    res = res.concat(orderedRes[i]);
  }
  return res;
}

function loopDir(dir, root, md5Obj) {
  let files = fs.readdirSync(dir);
  files.forEach(function (file, index) {
    let filePath = PATH.join(dir, file);
    let stat = fs.statSync(filePath);
    if (stat.isFile()) {
      var buf = fs.readFileSync(filePath);
      md5Obj[filePath.substr(root.length + 1)] = md5(buf);
      //log(filePath.substr(root.length + 1), md5(buf));
    } else
      loopDir(filePath, root, md5Obj);
  });
}

function read(path) {
  return new Promise((resolve, reject) => {
    var readStream = sftp.createReadStream(path);
    readStream.on('data', function (chunk) {
      //log(`Received ${chunk.length} bytes of data.`, chunk.toString());
      log('read ', path);
      resolve(chunk.toString());
    });

    readStream.on('error', function (err) {
      //log(`Received ${chunk.length} bytes of data.`, chunk.toString());
      resolve('');
    });
    // readStream.on('end', function (data) {
    //   log('end', "sftp connection closed", data);
    // });
    // readStream.on('close', function () {
    //   log('close', "- file transferred succesfully");
    // });

    // // initiate transfer of file
    readStream.read();
  });
}


function upload(from, to) {
  //log('uploading... ', to);
  return mkdirPromise(PATH.dirname(to)).then(() => {
    return promise = new Promise((resolve, reject) => {
      var readStream = fs.createReadStream(from);
      var writeStream = sftp.createWriteStream(to);
      writeStream.on('close', function () {
        log("upload succesfully from ", from, ' to ', to);
        resolve();
      });
      writeStream.on('error', function (err) {
        log("uploading error! ", err);
        reject(err);
      });
      // initiate transfer of file
      readStream.pipe(writeStream);
    });
  })
}

function isErrorNotExist(err) {
  return err.toString().indexOf('does not exist') > -1;
}

function getRootExistingDir(path) {
  let _resolve;
  let _reject;
  let promise = new Promise((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  })
  opendir(path, _resolve);
  return promise;
}

function opendir(path, resolve) {
  sftp.readdir(path, function (err, list) {
    if (err) {
      log(err, path);
      opendir(PATH.dirname(path), resolve);
    } else {
      log(path, list);
      resolve(list);
    }
  });
}

function unlink(path) {
  return new Promise((resolve, reject) => {
    sftp.unlink(path, function (err) {
      if (err) {
        if (err.toString().indexOf('does not exist') > -1)
          resolve();
      } else {
        log(path, ' deleted');
        resolve();
      }
    })
  });
}

function mkdirPromise(path) {
  return new Promise((resolve, reject) => {
    mkdir(path, resolve);
  })
}

function mkdir(path, resolve) {
  //log('mkdir ', path);
  sftp.mkdir(path, (err) => {
    if (err) {
      //log(err, path);
      if (err.toString().indexOf('already exist') > -1)
        resolve();
      else
        mkdir(PATH.dirname(path), () => mkdir(path, resolve));
    } else {
      log('mkdir ', path);
      resolve();
    }
  });
}

function log() {
  let str = '';
  for (let i = 0; i < arguments.length; i++)
    str += arguments[i].toString();
  console.log(str);
}

module.exports = {
  upload: gulp.series("publish", "uploadonly"),
}