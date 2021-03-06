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


var express = require('express');
var socketio = require('socket.io');
var net = require('http');
var http = require('http');
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');
var util = require('util');
var cons = require('consolidate');
var querystring = require('querystring');
var cookie = require('cookie');
var connect = require('connect');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var systemd = require('systemd')
require('autoquit');

global.config = require('./config');
global.coderlib = require('./apps/coderlib/app');

var loadApp = function( path, appname, auth ) {
    var loadpath = path + appname + "/app";

    var userapp = null;
    if ( config.cacheApps ) {
        userapp = require(loadpath);
    } else {

        var cached = require.cache[loadpath + '.js'];
        if ( cached ) {
            userapp = require(loadpath);
            if ( userapp.on_destroy ) {
                userapp.on_destroy();
            }
            delete require.cache[loadpath + ".js"];
        }
        userapp = require(loadpath);
    }

    if (userapp)
    {
        userapp.settings.appname = appname;
        userapp.settings.viewpath="apps/" + appname;
        userapp.settings.appurl="/app/" + appname;
        userapp.settings.staticurl = "/static/apps/" + appname;
        userapp.settings.device_name = auth.getDeviceName();
        userapp.settings.coder_owner = auth.getCoderOwner();
        userapp.settings.coder_color = auth.getCoderColor();

        if ( userapp.settings.device_name === "" ) {
            userapp.settings.device_name = "Coder";
        }
        if ( userapp.settings.coder_color === "" ) {
            userapp.settings.coder_color = "#3e3e3e";
        }
    }

    return userapp;
}

var apphandler = function( req, res, appdir ) {

    var appname = req.params[0];
    var apppath = req.params[1];

    auth = require(appdir + "auth" + "/app");
    var userapp = loadApp( appdir, appname, auth );

    if ( !apppath ) {
        apppath = "/";  
    } else {
        apppath = "/" + apppath;        
    }

    util.log( "GET: " + apppath + " " + appname );

    //Redirect to sign-in for unauthenticated users
    publicAllowed = ["auth"]; //apps that are exempt from any login (should only be auth)
    user = auth.isAuthenticated(req, res);
    if ( !user && publicAllowed.indexOf( appname ) < 0) {
        util.log( "redirect: " + '/app/auth' );
        res.redirect('/app/auth');
        return;
    }

    var routes = [];
    if ( req.method === 'GET' ) {
        routes = userapp.get_routes;
    } else if ( req.method === 'POST' ) {
        routes = userapp.post_routes;
    }

    if ( routes ) {
        var found = false;
        for ( var i in routes ) {
            route = routes[i];
            if ( route['path'] instanceof RegExp ) {
                var m = route['path'].exec( apppath );
                if ( m ) {      
                    userapp[route['handler']]( req, res, m );
                    found = true;
                    break;
                }

            } else if ( route['path'] === apppath ) {
                userapp[route['handler']]( req, res );
                found = true;
                break;
            }       

        }

        if ( !found ) {
            res.status( 404 );
            res.render('404', {
                title: 'error'
            });
        }
    }
};

var storeSecret = crypto.randomBytes(16).toString('utf-8');
var sessionStore = new session.MemoryStore();

var io;
var socketMap={};
var initSocketIO = function( server ) {
    io = socketio.listen( server );
    var sioCookieParser = cookieParser(storeSecret);

    io.set('log level', 1); //TODO: hack to fix recursion problem since we are piping log info to a socket

    io.set('authorization', function (handshake, accept) {
        sioCookieParser(handshake, {}, function(err) {
            if (err) {
                accept(err, false);
            }
            else {
                sessionStore.get(handshake.signedCookies["connect.sid"], function(err, sessionData) {
                    if (err || !sessionData) {
                        accept('Session error', false);
                    }
                    else {
                        handshake.sessionStore = sessionStore;
                        handshake.session = new session.Session(handshake, sessionData);
                        accept(null, true);
                    }
                });
            }
        });
    });


    var genRandomID = function() {
        var id = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i=0; i < 32; i++ ) {
            id += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return id;
    }


    io.sockets.on('connection', function (socket) {

        socket.session = socket.handshake.session;

        socket.socketID = genRandomID();
        socketMap[socket.socketID] = socket;
        socket.emit('SOCKETID', socket.socketID);

        socket.on('disconnect', function() {
            delete( socketMap[socket.socketID] );
        });

        socket.on('appdata', function(data) {
            if ( !socket.session.authenticated ) {
                return;
            }
            if ( data.appid !== undefined && data.appid.match(/^\w+$/) && data.key !== undefined ) {
                var appname = data.appid;
                var auth = require( __dirname + "/apps/auth/app" );
                var userapp = loadApp( __dirname + '/apps/', appname, auth );

                var route;
                var key = data.key;
                var routes = userapp.socketio_routes;
                if ( routes ) {
                    var found = false;
                    for ( var i in routes ) {
                        route = routes[i];
                        if ( route['key'] instanceof RegExp ) {
                            var m = route['path'].exec( key );
                            if ( m ) {      
                                userapp[route['handler']]( socket, data.data, m );
                                found = true;
                                break;
                            }

                        } else if ( route['key'] === key ) {
                            userapp[route['handler']]( socket, data.data );
                            found = true;
                            break;
                        }       

                    }
                }
            }
        });
    });
};

// Allow front end console to receive server logs over a socket connection.
// Note that util.log will still only go to stdout
var origlog = console.log;
console.log = function() {
    origlog.apply( console, arguments );
    if ( io ) {
        io.set('log level', 1);
        var clients = io.sockets.clients();
        for ( var x=0; x<clients.length; x++ ) {
            var c = clients[x];
            var sess = c.session;
            if ( sess.authenticated ) {
                c.emit('SERVERLOG', d);
            }
        }
    }
};


var pingEnabled = config.enableStatusServer;
var pingStatusServer = function() {
    var server = config.statusServer;
    var auth = auth = require(process.cwd() + "/apps/auth/app"); //needed for DeviceName
    var devicename = auth.getDeviceName();

    if ( typeof server === 'undefined' || server === "" || !pingEnabled ) {
        return;
    }

    if ( typeof devicename === 'undefined' || devicename === "" ) {
        devicename = "Unconfigured Coder";
    }

    var options = {
        host: server,
        port: '80',
        method: 'POST',
        path: '/api/coder/status',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    var postreq = http.request( options, function( postres ) {
        postres.on('data', function(d) {
            util.log( 'ping data: ' + d );
        });
        //TODO: do we do anything with response?
    });
    postreq.on('socket', function( postsocket ) {
        postsocket.setTimeout(10 * 1000);
        postsocket.on('connect', function( postconnection ) {
            var data = {
                ip: postreq.socket.address().address,
                coder_name: devicename,
                network: ''
            };
            var postdata = querystring.stringify( data );
            postreq.setHeader( 'Content-Length', postdata.length );
            postreq.write( postdata );
            postreq.end();
        });
    });
    postreq.on('error', function(e) {
        util.log('PING ERROR: ' + e );
    });

    setTimeout( pingStatusServer, 30 * 1000 );
};

var getHost = function( req ) {
    var host = req.connection.address().address;
    if ( typeof req.headers.host !== "undefined" ) {
        host = req.headers.host;
        if ( host.match(/:/g) ) {
            host = host.slice( 0, host.indexOf(":") );
        }
    }
    return host;
};

var coderapp = express();
coderapp.engine( 'html', cons.mustache );
coderapp.set( 'view engine', 'html' );
coderapp.set( 'views', __dirname + '/views' );
coderapp.use( bodyParser() );
coderapp.use( cookieParser() );
coderapp.use( session({
    key: 'connect.sid',
    secret: storeSecret,
    store: sessionStore
}));
coderapp.use( '/static', express.static( __dirname + '/static' ) );
coderapp.get( '/', function( req, res ) {
    util.log( 'GET: /' );
    res.redirect( '/app/auth' );
});
coderapp.all( /^\/app\/(\w+)\/(.*)$/, function( req, res ) { apphandler( req, res,  __dirname + '/apps/'); } );
coderapp.all( /^\/app\/(\w+)\/$/, function( req, res ) { apphandler( req, res,  __dirname + '/apps/'); } );
coderapp.all( /^\/app\/(\w+)$/, function( req, res ) { apphandler( req, res,  __dirname + '/apps/'); } );


var server = http.createServer(coderapp);
if (config.idleTimeout) {
    server.autoQuit({ timeOut: config.idleTimeout });
}

if (Array.isArray(config.listen))
    var listenfn = server.listen.bind(server, config.listen[0], config.listen[1]);
else
    var listenfn = server.listen.bind(server, config.listen);

listenfn(function() {
    initSocketIO(server);

    pingStatusServer();

    systemd.notify();

    process.on('uncaughtException', function(err) {
        console.log('WARNING: unhandled exception: ' + err );
    });
});

