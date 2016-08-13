var _ = require('lodash');
var async = require('async');
var fs = require('fs');

/**
 * Created by ogi on 27.05.16.
 */
function ReactIntlPlugin(options) {
  this.options = options;
}

ReactIntlPlugin.prototype.apply = function (compiler) {

  var __this = this;
  var messages = {};

  compiler.plugin("compilation", function (compilation) {
    // console.log("The compiler is starting a new compilation...");

    compilation.plugin("normal-module-loader", function (context, module) {
      // console.log("registering function: ", __dirname, "in loader context");
      context["metadataReactIntlPlugin"] = function (metadata) {
        // do something with metadata and module
        // console.log("module:",module,"collecting metadata:", metadata);
        messages[module.resource] = metadata["react-intl"].messages;
      };
    });
  });

  compiler.plugin('emit', function (compilation, callback) {
    // console.log("emitting messages");

    // check for duplicates and flatten
    var jsonMessages = [];
    var idIndex = {};
    Object.keys(messages).map(function (e) {
      messages[e].map(function (m) {
        if (!idIndex[m.id]) {
          idIndex[m.id] = e;
          jsonMessages.push(m);
        } else {
          compilation.errors.push("ReactIntlPlugin -> duplicate id: '" + m.id + "'.Found in '" + idIndex[m.id] + "' and '" + e + "'.");
        }
      })
    });

    var jsonString = JSON.stringify(jsonMessages, undefined, 2);
    // console.log("jsonString:",jsonString);
    var fileName = 'translations/' + __this.options.defaultLang + '.json' || 'en.json';
    var supportedLangs = __this.options.supportedLangs;

    if (Array.isArray(supportedLangs)) {
      async.each(supportedLangs, function (langObj, callbackEach) {
        delete require.cache[require.resolve(langObj.file)]
        var currentLangFile = require(langObj.file);
        var langName = langObj.lang;

        var messagesIntoLang = jsonMessages.reduce(function (array, message) {
          var transDone = _.find(currentLangFile, { id: message.id });

          if (transDone) {
            return array.concat([transDone]);
          } else {
            return array.concat([{ id: message.id, defaultMessage: '[TODO: ' + message.defaultMessage + ']'}]);
          }
        }, []);

        var messagesLangJson = JSON.stringify(messagesIntoLang, undefined, 2);

        compilation.assets['translations/' + langName + '.json'] = {
          source: function () {
            return messagesLangJson;
          },
          size: function () {
            return messagesLangJson.length;
          }
        };

        if (JSON.stringify(currentLangFile, undefined, 2) != messagesLangJson) {
          fs.writeFile(langObj.file,messagesLangJson, function() {
            callbackEach();
          });
        } else {
          callbackEach();
        }
      }, function finished() {
        // Insert this list into the Webpack build as a new file asset:
        compilation.assets[fileName] = {
          source: function () {
            return jsonString;
          },
          size: function () {
            return jsonString.length;
          }
        };

        var pathDef = __this.options.root + '/' + fileName;
        delete require.cache[require.resolve(pathDef)]
        var dTrans = require(pathDef);
        if (JSON.stringify(dTrans, undefined, 2) != jsonString) {
          fs.writeFile(pathDef,jsonString, function() {
            callback();
          });
        } else {
          callback();
        }
      });
    }
  });
};

module.exports = ReactIntlPlugin;
module.exports.metadataContextFunctionName = "metadataReactIntlPlugin";
