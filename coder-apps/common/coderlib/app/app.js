var fs = require('fs');
var util = require('util');
var async = require('async');

var getDateString = function( d ) {
    var now = new Date();
    var twodigits = function( x ) {
        return x<10 ? '0' + x: x;
    };
    return d.getFullYear() + "-" + twodigits(d.getMonth()+1) + '-' + twodigits(d.getDate());
};

// Required methods :
// App.prototype.load()
// App.prototype.require()
// App.prototype.view()
// App.name
// App.metadata
// App.staticURL
// App.appURL

var App = exports.App = function(name) {
    this.name = name;
    this.metadata = {
        created: getDateString( new Date() ),
        modified: getDateString( new Date() ),
        color: "#1abc9c",
        author: "Coder",
        name: name,
        hidden: false,
        public: false
    };
}

App.prototype._load = function(data) {
    var data = JSON.parse(data);
    for (attr in this.metadata) {

        if (typeof data[attr] !== 'undefined') {
            this.metadata[attr] = data[attr];
        }
    }
}

var LocalApp = exports.LocalApp = function(name) {
    LocalApp.super_.call(this, name);

    this.staticURL = "/static/apps/" + name;
    this.appURL = "/app/" + name;

    this.rootPath = LocalApp.appdir + name,
    this.metafile = LocalApp.appdir + name + "/app/meta.json";
    this.loadpath = LocalApp.appdir + name + "/app/index";
    this.viewpath = "apps/" + name + "/";
}

util.inherits(LocalApp, App);
LocalApp.appcache = Object.create(null);
LocalApp.appdir = process.cwd() + "/apps/";

LocalApp.prototype.load = function(callback) {
    callback = callback || function() {};
    var self = this;

    fs.readFile(self.metafile, { encoding: "utf-8" }, function(err, data) {
        if (err) {
            callback(err);
            return;
        }

        self._load(data);

        callback(null);
    });
};

LocalApp.prototype.require = function(callback) {
    callback(null, require(this.loadpath));
};

LocalApp.prototype.view = function(name) {
    if (!name)
        name = "index";
    return this.viewpath + name;
};

LocalApp.prototype.save = function(callback) {
    var data = JSON.stringify(this.metadata);

    fs.writeFile(this.metafile, data, { encoding: "utf-8" }, function (err) {
        if (callback) callback(err);
    });
};

LocalApp.prototype.invalidate = function() {
    var cached = require.cache[this.loadpath + '.js'];
    if ( cached ) {
        if ( cached.on_destroy ) {
            cached.on_destroy();
        }
        delete require.cache[this.loadpath + ".js"];
    }
};

LocalApp.prototype.remove = function(cb) {
    this.invalidate();
    delete LocalApp.appcache[name];

    rimraf(this.rootPath, function (err) {
        if (err) {
            cb(err);
        }
        async.each([ process.cwd() + "/views/apps/" + name, process.cwd() + "/static/apps/" + name ], fs.unlink, function(err) {
            cb (err);
        });
    });
}

LocalApp.find = function(name, callback) {
    callback = callback || function() {};

    if (LocalApp.appcache[name]) {
      callback(null, LocalApp.appcache[name]);
      return;
    }

    var userapp = new LocalApp(name);
    userapp.load(function(err) {
        if (err) {
            callback(err, null);
        }
        else {
            LocalApp.appcache[name] = userapp;
            callback(null, userapp);
        }
    });
}

LocalApp.list = function(callback, hidden) {
    fs.readdir(LocalApp.appdir, function(err, files) {
        if (err) {
            callback(err, null);
        }
        else {
            var apps = async.map(files,
                function(name, callback) {
                    LocalApp.find(name, function(err, app) {
                        // Don't propagate the error. If there is one, just pass a null value, it is filtered out later.
                        callback(null, err ? null : app);
                    });
                },
                function(err, apps) {
                    if (err) {
                        callback(err, null);
                    } else {
                        // Filter out the null ones and the ones we don't want (hidden, private, ...).
                        async.filter(apps,
                            function(item, callback) {
                                callback(item && (hidden || !item.metadata.hidden));
                            },
                            function(apps) {
                                callback(null, apps);
                            });
                    }
                });
        }
    });
}

var createLinks = function(name, cb) {
    var apppath = "../../apps/" + name + "/";
    var viewpath = process.cwd() + "/views/apps/" + name;
    var staticpath = process.cwd() + "/static/apps/" + name;

    fs.symlink(apppath + "views", viewpath, function(err) {
        if (err) {
            cb(err);
            return;
        }

        fs.symlink(apppath + "static", staticpath, function(err) {
            cb(err);
        });
    });
}

LocalApp.create = function(template, name, callback) {
    var appPath = process.cwd() + "/apps/" + name;
    var templatePath = path.resolve("apps/", template);

    ncp(templatePath, appPath, function(err) {
        if (err) {
            callback(err, null);
            return;
        }

        createLinks(name, function(err) {
            if (err) {
                callback(err, null);
                return;
            }

            LocalApp.find(name, callback);
        });
    });
}

