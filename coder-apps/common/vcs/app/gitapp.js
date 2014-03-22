"use strict";
var async = require("async");
var util = require("util");
var Git = require("./git");
var App = coderlib.App;
var LocalApp = coderlib.LocalApp;

var GitApp = exports = function(name, rev) {
    GitApp.super_.call(this, name);

    this.revision = rev;
    this.localApp = null;
    this.repo = null;
    this.tree = null;
    this.module = null;
};

util.inherits(GitApp, App);

GitApp.appcache = {};

GitApp.prototype.load = function(callback) {
    var self = this;
    async.waterfall([
        function(callback) {
            LocalApp.find(self.name, callback);
        },
        function(app, callback) {
            self.localApp = app;
            self.repo = new Git(self.localApp.rootPath);

            self.repo.parseCommit(self.revision, callback);
        },
        function(commit, callback) {
            self.tree = commit.tree;
            callback(null);
        }
    ], callback);
};

GitApp.prototype.require = function(callback) {
    var self = this;
    if (this.module) {
        callback(null, this.module);
        return;
    }

    async.waterfall([
        function(callback) {
            self.repo.findBlob(self.tree, "/app/index.js", callback);
        },
        function(blob, callback) {
            self.repo.cat_file(blob.object, blob.type, callback);
        },
        function(src, callback) {
            var Module = module.constructor;
            var m = new Module();
            m.paths = module.paths;
            m._compile(src, "/app/index.js");
            self.module = m;

            callback(null, m);
        }
    ], callback);
};

GitApp.find = function(name, rev, callback) {
    callback = callback || function() {};

    if (GitApp.appcache[name] && GitApp.appcache[name][rev]) {
      callback(null, GitApp.appcache[name][rev]);
    }

    var userapp = new GitApp(name, rev);
    userapp.load(function(err) {
        if (err) {
            callback(err, null);
        }
        else {
            GitApp.appcache[name] = GitApp.appcache[name] || Object.create(null);
            GitApp.appcache[name][rev] = userapp;
            callback(null, userapp);
        }
    });
};

GitApp.history = function(name, callback) {
    var repo;
    async.waterfall([
        LocalApp.find.bind(null, name),
        function(localApp, callback) {
            repo = new Git(localApp.rootPath);
            repo.rev_parse("HEAD", callback);
        },
        function(revision, callback) {
            var commits = [];

            (function loadRev(rev) {
                repo.parseCommit(rev, function(err, commit) {
                    if (err)
                        callback(err);
                    else {
                        commits.push(commit);
                        if (commit.parents.length == 0)
                            callback(null, commits);
                        else
                            loadRev(commit.parents[0]);
                    }
                });
            })(revision);
        }
    ], callback);
};


