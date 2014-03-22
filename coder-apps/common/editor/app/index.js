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

exports.get_routes = [
        { path:'/', handler:'index_handler'},
        { path: /^\/edit\/(\w+)$/, handler:'index_handler'},
        { path: /^\/api\/getcode\/(\w+)$/, handler:'api_getcode_handler'},
        { path: /^\/api\/media\/list\/(\w+)$/, handler:'api_media_list_handler'},
        { path: /^\/api\/metadata\/get\/(\w+)$/, handler:'api_metadata_get_handler'},
];

exports.post_routes = [
        { path: /^\/api\/savecode\/(\w+)$/, handler:'api_savecode_handler'},
        { path: /^\/api\/savesettings\/(\w+)$/, handler:'api_savesettings_handler'},
        { path: '/api/media/upload', handler:'api_media_upload_handler' },
        { path: '/api/media/remove', handler:'api_media_remove_handler' },
];


exports.index_handler = function( app, req, res, pathmatches ) {
    var tmplvars = {};

    var edit_appname;
    if ( pathmatches && pathmatches[1] != "" ) {
        tmplvars['edit_app_name'] = pathmatches[1];
    } else {
        //TODO: error
        res.end();
        return;
    }

    res.render( app.view(), tmplvars );
};


exports.api_metadata_get_handler = function( app, req, res, pathmatches ) {
    var apptoedit = "";
    if ( pathmatches && pathmatches[1] != "" ) {
        apptoedit = pathmatches[1];
    } else {
        //TODO: error
        return;
    }
    

    coderlib.app(apptoedit, function(err, app) {
        if (!err) {
            res.json({
                status: 'success',
                appname: apptoedit,
                metadata: app.metadata
            });
        } else {
            res.json({
                status: 'error'
            });
        }
    });
};

exports.api_getcode_handler = function( app, req, res, pathmatches ) {

    var path = process.cwd(); //root application path. different from __dirname
    var apptoedit = "";
    if ( pathmatches && pathmatches[1] != "" ) {
        apptoedit = pathmatches[1];
    } else {
        //TODO: error
        return;
    }
    var outdata = {
        htmldata: getFile( path + '/apps/' + apptoedit + '/views/index.html' ),
        jsdata:   getFile( path + '/apps/' + apptoedit + '/static/js/index.js' ),
        cssdata:  getFile( path + '/apps/' + apptoedit + '/static/css/index.css' ),
        appdata:  getFile( path + '/apps/' + apptoedit + '/app/index.js' )
    };

    res.json( outdata );
};

exports.api_media_list_handler = function( app, req, res, pathmatches ) {
    media = exports.listMedia( pathmatches[1] );
    res.json({ media: media });
};


exports.api_media_remove_handler = function( app, req, res ) {
    
    var appname = req.param('appname');
    if ( !appname || appname === "" || !appname.match(/^(\w+)$/) ) {
        res.json( {status: 'error', error: "bad app name" } );
        return;
    }

    var fname = req.param('filename');
    if ( !fname || fname === "" || fname === "." || fname === ".." || !fname.match(/^([\w_\-\.])*$/) ) {
        res.json( {status: 'error', error: "bad file name" } );
        return;
    }
    
    var fpath = process.cwd() + '/apps/' + appname + '/static/media/' + fname;
    util.log("MEDIA DELETE: " + fpath );
    err = fs.unlinkSync( fpath );
    if ( !err ) {
        res.json( {status: 'success'} );
    } else {
        res.json( {status: 'error', error: "couldn't delete file"} );
    }
};

exports.api_media_upload_handler = function( app, req, res ) {
    
    var appname = req.param('appname');
    if ( !appname || appname === "" || !appname.match(/^(\w+)$/) ) {
        res.json( {status: 'error', error: "bad app name" } );
        return;
    }

    if ( req.files && req.files['mediaUpload'] ) {
        var file = req.files.mediaUpload;
        var fname = file.name;
        fname = fname.substr( fname.lastIndexOf('/') + 1);
        fname = fname.replace(/[^\w_\-\.]/g, "_");
        
        if ( fname && fname != "" && fname != "." && fname != ".." ) {
            fs.readFile(file.path, function (err, data) {
                if ( err ) {
                    res.json( {status: 'error', error: "couldn't read file"} );
                    return;
                }
                var path = process.cwd() + '/apps/' + appname + '/static/media/' + fname;
                fs.writeFile(path, data, function (err) {
                    if ( !err ) {
                        res.json({ 
                            status: 'success',
                            filename: fname
                        });
                    } else {
                        res.json( {status: 'error', error: "couldn't save file"} );
                        return;
                    }
                });
            });
        } else {
            res.json( {status: 'error', error: "bad filename"} );
            return;
        }
    } else {
        res.json( {status: 'error', error: "missing attachment" } );
        return;
    }

};


exports.api_savecode_handler = function( app, req, res, pathmatches ) {
    var path = process.cwd();
    var apptoedit = "";
    if ( pathmatches && pathmatches[1] != "" ) {
        apptoedit = pathmatches[1];
    } else {
        //TODO: error
        return;
    }

    var datatype = req.param('type');
    var data = req.param('data');
    var filepath = null;
    if ( datatype === 'css' ) {
        filepath = path + '/apps/' + apptoedit + '/static/css/index.css'
    } else if ( datatype === 'html' ) {
        filepath = path + '/apps/' + apptoedit + '/views/index.html'
    } else if ( datatype === 'js' ) {
        filepath = path + '/apps/' + apptoedit + '/static/js/index.js'
    } else if ( datatype === 'app' ) {
        filepath = path + '/apps/' + apptoedit + '/app/index.js'
    }

    coderlib.app(apptoedit, function(err, app) {
        if (err) {
            res.json({
                status: 'error'
            });
            return;
        }

        app.metadata.modified = getDateString( new Date() );
        app.save(function(err) {
            if (err) {
                res.json({
                    status: 'error'
                });
                return;
            }

            fs.writeFile( filepath, data, 'utf8', function(err) {
                if (err) {
                    res.json({
                        status: 'error'
                    });
                    return;
                }


                util.log('app: ' + apptoedit + ' saved. flushing cache.');

                app.invalidate();

                res.json({
                    status: "success",
                    type: datatype,
                    data: data,
                    metadata: app.metadata,
                });
            });
        });
    });
};


exports.api_savesettings_handler = function( app, req, res, pathmatches ) {
    var path = process.cwd();
    var apptoedit = "";
    if ( pathmatches && pathmatches[1] != "" ) {
        apptoedit = pathmatches[1];
    } else {
        //TODO: error
        return;
    }
    
    var newmetadata = JSON.parse(req.param('metadata'));

    coderlib.app(apptoedit, function(err, app) {
        for (attr in app.metadata) {
            if (typeof newmetadata[attr] != 'undefined') {
                app.metadata[attr] = newmetadata[attr];
            }
        }

        app.metadata.modified = getDateString( new Date() );

        app.save(function(err) {
            res.json({
                metadata: app.metadata,
                appname: apptoedit
            });
        });
    });
};


exports.listMedia = function( appname ) {
    var path = process.cwd(); //root application path. different from __dirname
    var mediadir = path + "/apps/" + appname + "/static/media/";
    var media = {};
    var files = fs.readdirSync(mediadir);
    for ( var x in files ) {
        var filename = files[x];
        var info = fs.statSync( mediadir + filename );
        if ( typeof info !== 'undefined' && info && info.isFile() && filename !== '.gitignore' ) {
            var metainfo = {
                created: getDateString( info.mtime ),
                size: info.size,
            };
            
            media[filename] = { filename: filename, metadata: metainfo };
        }
    }
    return media;
};

var moveProject = function( fromid, toid ) {
    var path = process.cwd();
    fs.renameSync( path + "/apps/" + fromid, path + "/apps/" + toid );
    fs.renameSync( path + "/static/apps/" + fromid, path + "/static/apps/" + toid );
    fs.renameSync( path + "/views/apps/" + fromid, path + "/views/apps/" + toid );
};

var getFile = function( fpath ) {
    try {
        return fs.readFileSync( fpath, 'utf8' );
    } catch (e) {
        return "";
    }
};

var getDateString = function( d ) {
    var now = new Date();
    var twodigits = function( x ) {
        return x<10 ? '0' + x: x;
    };
    return d.getFullYear() + "-" + twodigits(d.getMonth()+1) + '-' + twodigits(d.getDate());
};
