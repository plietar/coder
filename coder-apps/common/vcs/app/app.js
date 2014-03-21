var pathutil = require('path');
var fs = require('fs');
var async = require('async');
var Git = require('./git');
var mime = require('mime');

var isVersionned = function(app, callback) {
    fs.fileExists(callback);
};

exports.get_routes = [
    { path:'/', handler:'index_handler' },
    { path:/^\/view\/(\w+)\/([0-9a-f]+)\/static\/(.+)$/, handler: 'static_handler' }
];

exports.post_routes = [
];


exports.index_handler = function( app, req, res ) {
    res.render( app.view() );
};

exports.static_handler = function( app, req, res, match ) {
    var appname = match[1];
    var rev = match[2];
    var path = pathutil.resolve("/static", match[3]);

    var repo;
    async.waterfall([
        coderlib.app.bind(null, appname),
        function(app, callback) {
            repo = new Git(app.rootPath);
            repo.parseCommit(rev, callback);
        },
        function(commit, callback) {
            repo.findBlob(commit.tree, path, callback);
        },
        function(blob, callback) {
            repo.cat_file(blob.object, blob.type, callback);
        }
    ], function(err, data) {
        if (err)
        {
            console.log(err);
            res.send(404);
        }
        else
        {
            res.setHeader("Content-Type", mime.lookup(path));
            res.send(data);
        }
    });
};

exports.on_destroy = function() {
};

