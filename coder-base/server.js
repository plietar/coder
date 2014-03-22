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
var https = require('https');
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');
var util = require('util');
var cons = require('consolidate');
var params = require('express-params');
var querystring = require('querystring');
var cookie = require('cookie');
var connect = require('connect');

global.config = require('./config');
global.coderlib = require('./apps/coderlib/app/index');

var auth = require('./apps/auth/app/index');

var apphandler = function( req, res, appdir ) {
    var appname = req.params[0];
    var apppath = req.params[1];

    if ( !apppath ) {
        apppath = "/";  
    } else {
        apppath = "/" + apppath;        
    }

    util.log( req.route.method + ": " + apppath + " " + appname );

    coderlib.app(appname, function(err, app) {
        if (err) {
            res.status( 404 );
            res.render('404', {
                title: 'error'
            });
            return;
        }

        //Redirect to sign-in for unauthenticated users
        var user = auth.isAuthenticated(req, res);
        if ( !user && !app.metadata.public) {
            util.log( "redirect: " + '/app/auth' );
            res.redirect('/app/auth');
            return;
        }

        app.exec(req, res, apppath);
    });
};


var loadSslCert = function(callback) {
    privateKeyFile=path.normalize('certs/server.key');
    certificateFile=path.normalize('certs/server.cert');

    var privateKey="";
    var certificate="";
    try {
        privateKey = fs.readFileSync(privateKeyFile).toString();
        certificate = fs.readFileSync(certificateFile).toString();
    } catch ( e ) {
        util.print( "no certificate found. generating self signed cert.\n" );
    }

    if ( privateKey !== "" && certificate !== "" ) {
        callback(privateKey, certificate);
    } else {
        var spawn = require('child_process').spawn;

        var genSelfSignedCert = function(keyFile, certFile) {
            var genkey = spawn( 'openssl', [
                    'req', '-x509', '-nodes',
                    '-days', '365',
                    '-newkey', 'rsa:2048',
                    '-keyout', keyFile,
                    '-out', certFile,
                    '-subj',
                    '/C=' + config.country + '/ST=' + config.state + "/L=" + config.locale + "/CN=" + config.commonName + "/subjectAltName=" + config.subjectAltName
                    ]);
            genkey.stdout.on('data', function(d) { util.print(d) } );
            genkey.stderr.on('data', function(d) { util.print(d) } );
            genkey.addListener( 'exit', function( code, signal ) {
                fs.chmodSync(privateKeyFile, '600');
                loadServer();
            });
        };        
        var loadServer = function() {
            privateKey = fs.readFileSync(privateKeyFile).toString();
            certificate = fs.readFileSync(certificateFile).toString();

            callback(privateKey, certificate);
        };

        genSelfSignedCert(privateKeyFile, certificateFile);
    }
};

var storeSecret = crypto.randomBytes(16).toString('utf-8');
var sessionStore = new express.session.MemoryStore();

var io;
var socketMap={};
var initSocketIO = function( server ) {
    io = socketio.listen( server );
    var sioCookieParser = express.cookieParser(storeSecret);

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
                        handshake.session = new express.session.Session(handshake, sessionData);
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

                coderlib.app(appname, function(err, app) {
                    if (err) {
                        return;
                    }
                    userapp = app.require()

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
                                    userapp[route['handler']]( app, socket, data.data, m );
                                    found = true;
                                    break;
                                }

                            } else if ( route['key'] === key ) {
                                userapp[route['handler']]( app, socket, data.data );
                                found = true;
                                break;
                            }       

                        }
                    }
                });
            }
        });
    });
};

// Allow front end console to receive server logs over a socket connection.
// Note that util.log will still only go to stdout
var origlog = console.log;
console.log = function(d) {
    origlog.call( console, d );
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
    var devicename = coderlib.device.device_name;

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
params.extend( coderapp );
coderapp.engine( 'html', cons.mustache );
coderapp.set( 'view engine', 'html' );
coderapp.set( 'views', __dirname + '/views' );
coderapp.use( express.bodyParser() );
coderapp.use( express.cookieParser() );
coderapp.use( express.session({
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

if (config.ssl.enable)
{
    //HTTP is all redirected to HTTPS
    var redirectapp = express();
    params.extend( redirectapp );
    redirectapp.engine( 'html', cons.mustache );
    redirectapp.all( /.*/, function( req, res ) {
        util.log( 'redirect: ' + getHost(req) + ":" + config.httpsVisiblePort + " " + req.url );
        res.redirect("https://" + getHost(req) + ":" + config.httpsVisiblePort  + req.url);
    });

    http.createServer(redirectapp).listen(config.httpListenPort, config.listenIP);

    loadSslCert(function (key, cert) {
        var server = https.createServer({ key: key, cert: cert }, coderapp);
        server.listen(config.httpsListenPort, config.listenIP);
        initSocketIO(server);
    });
}
else
{
    var server = http.createServer(coderapp);
    server.listen(config.httpListenPort, config.listenIP);
    initSocketIO(server);
}

pingStatusServer();

process.on('uncaughtException', function(err) {
    console.log('WARNING: unhandled exception: ' + err.stack );
});

