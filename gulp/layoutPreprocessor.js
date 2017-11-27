// https://github.com/libxmljs/libxmljs

const gulp = require("gulp");
const libxml = require("libxmljs");
const fsp = require("fs-promise");
const fs = require("fs");
const logger = require("./logger");
const helper = require("./helper");
const pd = require('pretty-data').pd;
const path = require('path');
const argv = require("yargs").argv;
const REFERENCE_ATTR = "ref";

//let target = "dev";
let config;
let context = { lang: "en", target: "dev" };
let templates = {};

function applyAttributes(dist, tmpl) {
  dist.attrs().forEach(attr => {
    if (attr.name() !== REFERENCE_ATTR) {
      let a = tmpl.attr(attr.name());
      if (a) {
        a.value(attr.value());
      } else {
        let newattr = {};
        newattr[attr.name()] = attr.value();
        tmpl.attr(newattr);
      }
    }
  });
}

function applyPlaceholders(dist, tmpl) {
  let contents = dist.find("./placeholder");
  let placeholders = tmpl.find("//placeholder");
  if (placeholders.length == 0) {
    return;
  }
  let placeholderId = x => x.attr("id").value();
  contents.forEach(x => {
    let id = placeholderId(x);
    // let content = x.childNodes().find(x => x.type() === "element");
    // if (content) {
    //   console.log("==  content " + content.name());
    //   let placeholder = placeholders.find(y => placeholderId(y) === id);
    //   if (placeholder) {
    //     placeholder.replace(content);
    //   }
    // }
    let placeholder = placeholders.find(y => placeholderId(y) === id);
    x.childNodes().forEach(contentChild => {
      if (contentChild.type() === "element") {
        if (placeholder) {
          placeholder.addPrevSibling(contentChild);
        }
      }
    });
    if (placeholder) placeholder.remove();
  });
  //contents.forEach(x => x.remove());
  //placeholders.forEach(x => x.remove());
}

function applyIncludeTag(dist, tmpl) {
  applyAttributes(dist, tmpl);
  applyPlaceholders(dist, tmpl);
  dist.replace(tmpl);
}

function includeTagProcessor(xmlDoc) {
  let includeTags = xmlDoc.find("//include");
  if (includeTags.length > 0) {
    // let processed = includeTags.map(x => processXml(replaceKeyWord(x.attr(REFERENCE_ATTR).value())));
    // return Promise.all(processed)
    //   .then(nodes => nodes.forEach((x, i) => applyIncludeTag(includeTags[i], x)))
    //   .then(() => xmlDoc);
    let tag = includeTags[0];
    return promise = processXml(replaceKeyWord(tag.attr(REFERENCE_ATTR).value()))
      .then(x => applyIncludeTag(tag, x))
      .then(() => includeTagProcessor(xmlDoc));
  } else {
    return Promise.resolve(xmlDoc);
  }
}

function readTemplates(data) {
  let templateTags = data.find("//template");
  let promise = Promise.resolve();
  templateTags.forEach(tag => {
    let id = tag.attr("id").value();
    let ref = replaceKeyWord(tag.attr(REFERENCE_ATTR).value());
    console.log(ref, id);
    promise = promise.then(() => {
      return fsp.readFile(path.join(context.workdir, ref), "utf8")
        .then(data => libxml.parseXmlString(data))
        .then(data => {
          let template = data.find('./template[@id="' + id + '"]');
          if (template.length === 0)
            throw Error("Cannot find template ref=" + ref + " id=" + id);
          let templateAttr = helper.getAttrsObject(template[0]);
          let tagAttr = helper.getAttrsObject(tag);
          helper.mergeTo(tagAttr, templateAttr);
          let parsedTemp = helper.replaceKeys(template[0], templateAttr);
          parsedTemp.childNodes().forEach(child => {
            if (child.type() === "element") {
              tag.addPrevSibling(child);
            }
          });
          tag.remove();
        })
    });
  });
  return promise.then(() => data);
}

function applyIf(data) {
  let ifContext = helper.merge(getDeploymentConfig(), context);
  while (true) {
    let ifTags = data.find(".//if");
    if (ifTags.length === 0) break;
    tag = ifTags[0];
    let name = tag.attr("name").value();
    let value = tag.attr("value");
    let valueOnly = tag.attr("valueonly");
    let not = tag.attr("not");
    let inAttr = tag.attr("in");
    let valueCompared = valueOnly ? name : ifContext[name];
    not = not ? (not.value() == "true") : false;
    if (value) {
      if ((!not && valueCompared == value.value()) || (not && valueCompared != value.value()))
        moveChildNodesOut(tag);
      else
        tag.remove();
    } else if (inAttr) {
      let idx = inAttr.value().split(",").indexOf(valueCompared)
      if ((!not && idx > -1) || (not && idx == -1)) {
        moveChildNodesOut(tag);
      } else
        tag.remove();
    } else {
      throw Error('no "value" or "in" attribute in "if" tag');
    }
  }
  return data;
}

function applyForLoop(data) {

  while (true) {
    let forTags = data.find(".//for");
    if (forTags.length === 0) break;
    tag = forTags[0];
    let from = Number(tag.attr("from").value());
    let to = Number(tag.attr("to").value());
    let step = Number(tag.attr("step").value());
    let id = tag.attr("id") ? tag.attr("id").value() : "";
    let content = tag.find("./content");
    if (content.length === 0) throw Error("no content in from");
    applyForLoop(content[0]);

    let arguments = tag.find("./arguments");
    let contexts = {}
    if (arguments.length > 0) {
      arguments[0].childNodes().forEach(child => {
        if (child.type() === "element") {
          let attrs = {};
          child.attrs().forEach(attr => {
            if (attr.name() != "id")
              attrs[attr.name()] = attr.value();
          });
          contexts[child.attr("id").value()] = attrs;
        }
      });
    }
    for (let i = from; i <= to; i += step) {
      let context = helper.merge(contexts[i.toString()] || {}, contexts["default"] || {});
      content[0].childNodes().forEach(contentChild => {
        if (contentChild.type() === "element") {
          let str = contentChild.toString();
          str = str.replace(new RegExp(`{%index%}`, 'g'), i);
          str = str.replace(new RegExp(`{%index${id}%}`, 'g'), i);
          for (let key in context) {
            str = str.replace(new RegExp("{%" + key + "%}", 'g'), context[key]);
          }
          tag.addPrevSibling(libxml.parseXmlString(str).root());
        }
      });
    }
    tag.remove();
  }
  return data;
}

function moveChildNodesOut(node) {
  node.childNodes().forEach(child => {
    if (child.type() === "element") {
      node.addPrevSibling(child);
    }
  });
  node.remove();
}

function processXml(file) {
  return fsp
    .readFile(path.join(context.workdir, file), "utf8")
    .then(data => libxml.parseXmlString(data))
    .then(xmlDoc => readTemplates(xmlDoc))
    .then(xmlDoc => includeTagProcessor(xmlDoc))
    .then(data => applyForLoop(data))
    .then(data => applyIf(data))
    .then(x => x.root());
}

function saveFile(layout, name) {
  let file = path.join(context.workdir, name);
  let doc = replaceKeyWord(layout.toString(false));
  let rsp = fsp.writeFile(file, doc, "utf8");
  return rsp;
}

function process(_config, _context) {
  console.log(_config);
  let promise = Promise.resolve();
  context = helper.merge(_context, context);
  config = _config;
  config.layout.forEach(layout => {
    layout.des.forEach(des => {
      promise = promise.then(() => processOne(layout.src, des));
    })
  });
  return promise;
}

function processOne(src, des) {
  console.log("processOne ", src, des);
  let slashPos = des.indexOf("/");
  templates = {};
  context.platform = des.substr(0, slashPos);
  context.lang = des.substr(slashPos + 1, des.indexOf(".") - slashPos - 1);
  let dir = path.join(context.workdir, context.platform);
  if (!fs.existsSync(dir)) {
    console.log(dir, ' not existing');
    fs.mkdirSync(dir);
  }
  console.log(context);
  return processXml(src)
    .then(xml => removePlaceholder(xml))
    .then(data => saveFile(data, des));
  //.then(()=>new Promise(resolve => setTimeout(resolve, 20000)));
}

function removePlaceholder(xmlDoc) {
  let placeholders = xmlDoc.find("//placeholder");
  placeholders.forEach(placeholder => {
    placeholder.childNodes().forEach(child => {
      if (child.type() === "element") {
        placeholder.addPrevSibling(child);
      }
    });
    placeholder.remove();
  });
  return xmlDoc;
}

function getDeploymentConfig() {
  //for testing
  if (config === undefined) return {};
  target = context.platform + context.target;
  let c = config.deployment[target] || config.deployment[context.target] || config.deployment['uat'];
  c.platform = context.platform;
  return c;
}

function replaceKeyWord(str) {
  let config = getDeploymentConfig();
  for (let key in config) {
    let value = config[key].toString().replace(/"/g, '&quot;');
    str = str.replace(new RegExp(`{%${key}%}`, 'g'), value);
  }
  return str;
}

gulp.task("test-layout", function (cb) {
  let name = argv.n || "layout";
  context.workdir = "./games/" + argv.id + "/engine/gulp/test/" + name;
  return processXml("main.xml")
    .then(xml => removePlaceholder(xml))
    .then(xml => fsp.writeFile(context.workdir + "/out.xml", xml.toString(), "utf8"))
    .catch(err => {
      console.log("error: ", err);
      cb();
    });
});

module.exports = {
  process: process,
  layouttest: gulp.series("test-layout")
}