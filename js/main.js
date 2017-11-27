var FS = require('fs');
var PATH = require('path');
var MD5 = require('md5');
const LIBXML = require("libxmljs");

var md5Obj = {};
var remoteMd5Obj = {};
var dataPath = "../data";
var md5FileName = "filesinfo.json";
var remotePath = "http://www.iyoovr.com/zhongshengyx/";
var REQUEST = require('request');

main();

function main() {
    console.log("loading ", remotePath);

    let config = FS.readFileSync(PATH.join(dataPath, "ui/config.xml"), "utf8");
    //config = LIBXML.parseXmlString(data);
    console.log(config);

    REQUEST.get(remotePath + md5FileName, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            //let json = body;
            remoteMd5Obj = JSON.parse(body);
            loopDir(dataPath, dataPath, md5Obj);
            let uploadingPaths = [];
            for (let key in md5Obj) {
                if (remoteMd5Obj[key] !== md5Obj[key] && !key.endsWith(md5FileName)) {
                    uploadingPaths.push(key);
                }
            }
            console.log(uploadingPaths);
        }
    });
    // loopDir(dataPath, dataPath, md5Obj);
    // FS.writeFileSync(PATH.join(dataPath, md5FileName), JSON.stringify(md5Obj, null, 2), "utf8");
    // console.log(md5Obj);
}


function applyPathFilter(paths, filters) {
  if (filters === undefined || filters.length === 0) return paths;
  let res = [];
  for (let i = 0; i < paths.length; i++) {
    let path = paths[i];
    for (let j = filters.length - 1; j > -1; j--) {
      if (path.match(filters[j])) {
        res[j].push(path);
        break;
      }
    }
  }
  return res;
}


function loopDir(dir, root, md5Obj) {
    let files = FS.readdirSync(dir);
    files.forEach(function (file, index) {
        let filePath = PATH.join(dir, file);
        let stat = FS.statSync(filePath);
        if (stat.isFile()) {
            var buf = FS.readFileSync(filePath);
            md5Obj[filePath.substr(root.length + 1)] = MD5(buf);
            //log(filePath.substr(root.length + 1), md5(buf));
        } else
            loopDir(filePath, root, md5Obj);
    });
}