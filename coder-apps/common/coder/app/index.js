/**
 * Coder for Raspberry Pi
 * A simple platform for experimenting with web stuff.
 * http://goo.gl/coder
 *
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var mustache = require('mustache');
var util = require('util');
var fs = require('fs');
var spawn = require('child_process').spawn;
var tmp = require('tmp');
var async = require('async');

//hack to make fs.existsSync work between different node versions
if ( !fs.existsSync ) {
    var path = require('path');
    fs.existsSync = path.existsSync;
}

exports.get_routes = [
    { path:'/', handler:'index_handler' },
    { path: /^\/export\/download\/(\w+)\.zip$/, handler:'export_download_handler' }
];


exports.post_routes = [
    { path: '/api/app/create', handler:'api_app_create_handler' },
    { path: /^\/api\/app\/remove\/(\w+)$/, handler:'api_app_remove_handler' },
    { path: "/api/app/import", handler:'api_app_import_handler' }
];

exports.on_destroy = function() {
};

exports.index_handler = function( app, req, res ) {
    res.render( app.view() );
};

var getAppIDFromTitle = function( apptitle ) {
    var newappid = apptitle.toLowerCase();
    newappid = newappid.replace(/\./g, "_");
    newappid = newappid.replace(/[^\w]/g, "_");
    newappid = newappid.replace(/_+/g, "_");
    return newappid;
};

var getAvailableNewAppID = function( newappid ) {
    //scan for an available id if this one exists already
    var idavailable = false;
    var iteration = 0;
    var appdir = process.cwd() + "/apps/";
    var allfiles = fs.readdirSync(appdir);
    while ( !idavailable ) {
        var potential = newappid;
        if ( iteration > 0 ) {
            potential = potential + '_' + iteration;
        }
        if ( allfiles.indexOf( potential ) >= 0 ) {
            iteration++;
        } else {
            newappid = potential;
            idavailable = true;
        }
    }
    return newappid;
};


exports.api_app_create_handler = function( app, req, res ) {

    var apptitle = req.param('app_title');
    var appcolor = req.param('app_color');
    
    if ( typeof apptitle === 'undefined' || apptitle === "" 
            || typeof appcolor === 'undefined' || appcolor === "" ) {
        res.json({
            status: 'error',
            error: 'invalid parameters'
        });
        return;
    }

    var newappid = getAppIDFromTitle( apptitle );
    
    if ( newappid === "" ) {
        res.json({
            status: 'error',
            error: 'invalid app id'
        });
    }

    newappid = getAvailableNewAppID( newappid );

    coderlib.createApp("boilerplate", newappid, function(err, app) {
        if (err) {
            res.json({
                status: 'error',
                error: err
            });
            return;
        }

        app.metadata = {
            created: getDateString( new Date() ),
            modified: getDateString( new Date() ),
            color: appcolor,
            author: coderlib.device.owner,
            name: apptitle,
            hidden: false,
            public: false
        };

        app.save(function(err) {
            if (err) {
                res.json({
                    status: 'error',
                    error: err
                });
            }
            else {
                res.json({
                    status: 'success',
                    appname: newappid
                });
            }
        });
    });
};

exports.export_download_handler = function( app, req, res, pathmatches ) {
    var appname;
    if ( pathmatches && pathmatches[1] !== "" ) {
        appname = pathmatches[1];
    } else {
        res.json({
            status: 'error',
            error: 'invalid parameters'
        });
        return;
    }

    res.contentType('zip');
    res.setHeader('Content-disposition', 'attachment; filename='+ appname + '.zip');    

    var path = process.cwd() + "/apps/" + appname;

    fs.exists(path, function(exists) {
        if (!exists) {
            res.send(404);
            return;
        }

        // Options -r recursive  - redirect to stdout
        var zip = spawn('zip', ['-r', '-', '.'], {cwd: path});

        // Keep writing stdout to res
        zip.stdout.on('data', function (data) {
            res.write(data);
        });

        // End the response on zip exit
        zip.on('exit', function (code) {
            if(code !== 0) {
                res.statusCode = 500;
                console.log('zip process exited with code ' + code);
                res.end();
            } else {
                res.end();
            }
        });
    });
};


exports.api_app_import_handler = function( app, req, res ) {

    if ( !req.files || !req.files['import_file'] ) {
        res.json({
            status: 'error',
            error: 'invalid parameters'
        });
        return;
    }

    if ( !req.files['import_file'].type == 'application/zip' ) {
        res.json({
            status: 'error',
            error: 'invalid file type'
        });
        return;
    }

    tmp.dir( { mode: 0755, unsafeCleanup: true }, function(err, tmpPath) {
        var unzip = spawn('unzip', [req.files['import_file'].path], { cwd: tmpPath });

        unzip.on('exit', function (code) {
            if(code !== 0) {
                res.json({
                    status: "error",
                    error: "unzip error: " + code
                });
            } else {
                console.log(tmpPath);
                async.every([
                    tmpPath + '/app/meta.json',
                    tmpPath + '/app/app.js',
                    tmpPath + '/views/index.html',
                    tmpPath + '/static/css/index.css',
                    tmpPath + '/static/js/index.js'],
                    fs.exists,
                    function (result) {
                        if (!result) {
                            res.json({
                                status: "error",
                                error: "Invalid application bundle"
                            });
                            return;
                        }

                        fs.readFile( tmpPath + '/app/meta.json', 'utf-8', function (err, data) {
                            if (err) {
                                res.json({
                                    status: "error",
                                    error: "cannot open project file"
                                });
                                return;
                            }

                            var metadata = JSON.parse(data);
                            if (!metadata || !metadata.name) {
                                res.json({
                                    status: "error",
                                    error: "invalid project file"
                                });
                                return;
                            }

                            var newappid = getAppIDFromTitle( metadata.name );
                            if ( newappid === "" ) {
                                res.json({
                                    status: 'error',
                                    error: 'invalid app id'
                                });
                                return;
                            }

                            newappid = getAvailableNewAppID( newappid );

                            coderlib.createApp(tmpPath, newappid, function(err, app) {
                                if (err) {
                                    res.json({
                                        status: 'error',
                                        error: err
                                    });
                                } else {
                                    res.json({
                                        status: "success",
                                        name: app.metadata.name,
                                        appname: app.name
                                    });
                                }
                            });
                        });
                    });
            }
        });
    });
}

exports.api_app_remove_handler = function( app, req, res, pathmatches ) {
    var apptoremove = "";
    if ( pathmatches && pathmatches[1] !== "" ) {
        apptoremove = pathmatches[1];
    } else {
        res.json({
            status: 'error',
            error: 'invalid parameters'
        });
        return;
    }

    coderlib.app(apptoremove, function(err, app) {
        if (err) {
            res.json({
                status: "error",
                error: "Application doesn't exist"
            });
            return;
        } else {
            app.remove(function (err) {
                if (err) {
                    res.json({
                        status: "error",
                        error: err
                    });
                }
                else {
                    res.json({
                        status: "success",
                        data: "Application " + apptoremove + " removed."
                    });
                }
            });
        }
    });
};

var getDateString = function( d ) {
    var now = new Date();
    var twodigits = function( x ) {
        return x<10 ? '0' + x: x;
    };
    return d.getFullYear() + "-" + twodigits(d.getMonth()+1) + '-' + twodigits(d.getDate());
};

