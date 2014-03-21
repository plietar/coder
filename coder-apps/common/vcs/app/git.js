"use strict";
var spawn = require('child_process').spawn;
var byline = require('byline');
var async = require('async');
var util = require('util');
var path = require('path');

var Git = function(p)
{
    this.path = path.resolve(p);
};

Git.prototype.git = function(/* command, args, options, callback */)
{
    var command, gitargs = [], options = {}, callback = null;
    var args = Array.prototype.slice.call(arguments);

    command = args.shift();
    if (util.isArray(args[0]))
        gitargs = args.shift();
    if (typeof args[0] === "object")
        options = args.shift();
    if (typeof args[0] === "function")
        callback = args.shift();

    options.encoding = options.encoding || 'utf8';
    options.env = options.env || {};
    options.cwd = options.cwd || this.path;

    gitargs.unshift(command);
    var child = spawn("git", gitargs, { cwd: options.cwd, env: options.env});

    child.stderr.setEncoding('utf8');
    child.stdout.setEncoding(options.encoding);

    if (callback) {
        var called = false;
        var error = "Unknown error";

        child.on('close', function (code) {
            if (code === 0) {
                callback(null);
            }
            else if (!called) {
                called = true;
                callback(error);
            }
        });

        child.on('error', function (err) {
            if (!called) {
                called = true;
                callback(err);
            }
        });

        var stderr = byline(child.stderr);

        stderr.on('data', function (line) {
            if (line.indexOf("fatal: ") === 0)
                error = line;
        });
    }

    return child;
};

Git.prototype.status = function(callback) {
    var result = Object.create(null);

    var child = this.git("status", ["--porcelain"], function(err) {
        if (err) callback(err, null);
        else callback(null, result);
    });

    var stream = byline(child.stdout);

    stream.on('data', function (line) {
        result[line.slice(3)] = line.slice(0, 2);
    });
};

Git.prototype.addAll = function(callback) {
    this.git("add", ["--all", ":/"], callback);
};

Git.prototype.update_ref = function(/* ref, value, oldvalue, callback */) {
    var ref, value, oldvalue, callback;
    var args = Array.prototype.slice.call(arguments);

    ref = args.shift();
    value = args.shift();
    if (typeof args[0] === "string")
        oldvalue = args.shift();
    callback = args.shift();

    if (oldvalue !== null)
        this.git("update-ref", [ref, value, oldvalue], callback);
    else
        this.git("update-ref", [ref, value], callback);
};


Git.prototype.write_tree = function(callback) {
    var result = null;

    var child = this.git("write-tree", function(err) {
        if (err) callback(err, null);
        else callback(null, result);
    });

    var stream = byline(child.stdout);

    stream.on('data', function (line) {
        result = line;
    });
};

Git.prototype.commit_tree = function(/* tree, message, parents, options, callback */) {
    var tree, message, parents = [], options = {}, callback;
    var args = Array.prototype.slice.call(arguments);

    tree = args.shift();
    message = args.shift();
    if (args[0] == null)
        args.shift(); // Just no parents
    else if (util.isArray(args[0]))
        parents = args.shift();
    else if (typeof args[0] === "string")
        parents = [args.shift()];
    if (typeof args[0] === "object")
        options = args.shift();
    callback = args.shift();

    var result = null;

    var gitargs = [tree];
    for (var k in parents) {
        gitargs.push("-p");
        gitargs.push(parents[k]);
    }

    var env = {};
    if (options.author) {
        env.GIT_AUTHOR_NAME  = options.author.name;
        env.GIT_AUTHOR_EMAIL = options.author.email;
    }
    if (options.committer) {
        env.GIT_COMMITTER_NAME  = options.committer.name;
        env.GIT_COMMITTER_EMAIL = options.committer.email;
    }

    var child = this.git("commit-tree", gitargs, {env: env}, function(err) {
        if (err) callback(err, null);
        else callback(null, result);
    });

    var stream = byline(child.stdout);

    stream.on('data', function (line) {
        result = line;
    });

    child.stdin.write(message);
    child.stdin.end();
};

Git.prototype.rev_parse = function(rev, callback) {
    var result = null;

    var child = this.git("rev-parse", [rev], function(err) {
        if (err) callback(err, null);
        else callback(null, result);
    });

    var stream = byline(child.stdout);

    stream.on('data', function (line) {
        result = line;
    });
};

Git.prototype.commit = function(/* message, options, callback */) {
    var message, options = {}, callback;
    var args = Array.prototype.slice.call(arguments);

    message = args.shift();
    if (typeof args[0] === "object")
        options = args.shift();
    callback = args.shift();
    
    var parent;
    var self = this;    

    async.waterfall([
        function(callback) {
            self.rev_parse("HEAD", function(err, result) {
                parent = err ? null : result;
                callback(null);
            });
        },
        function(callback) {
            self.write_tree(callback);
        },
        function(tree, callback) {
            self.commit_tree(tree, message, parent, {author: options.author, committer: options.committer}, callback);
        },
        function(commit, callback) {
            self.update_ref("HEAD", commit, parent, function(err) {
                callback(err, commit);
            });
        }
    ], callback);
};

