var async = require("async");
var Git = require("./git");
var App = coderlib.App;
var LocalApp = coderlib.LocalApp;

var GitApp = exports.GitApp = function(name, rev) {
    GitApp.super_.call(this, name);

    this.revision = rev;
}

util.inherits(GitApp, App);

GitApp.appcache = {}

GitApp.prototype.load = function(callback) {
    async.waterfall([
        function(callback) {
            LocalApp.find(this.name, callback);
        },
        function(app, callback) {
            this.localApp = app;
            this.repo = new Git(this.localApp.rootPath);

            this.repo.parseCommit(this.revision, callback);
        },
        function(commit, callback) {
            this.tree = commit.tree;
            callback(null);
        }
    ], callback);
}

GitApp.prototype.require = function() {
    return null;
}


