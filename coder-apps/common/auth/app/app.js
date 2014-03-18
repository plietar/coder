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
var bcrypt = require('bcrypt');

exports.settings={};
//These are dynamically updated by the runtime
//settings.appname - the app id (folder) where your app is installed
//settings.viewpath - prefix to where your view html files are located
//settings.staticurl - base url path to static assets /static/apps/appname
//settings.appurl - base url path to this app /app/appname


exports.get_routes = [
    { path:'/', handler:'index_handler'},
    { path:'/login', handler:'login_handler'},
    { path:'/logout', handler:'logout_handler'},
    { path:'/configure', handler:'configure_handler'},
    { path:'/addpassword', handler:'addpassword_handler'},
    { path:'/changepassword', handler:'changepassword_handler'}
];


exports.post_routes = [
    { path: '/api/login', handler: 'api_login_handler' },
    { path: '/api/logout', handler: 'api_logout_handler' },
    { path: '/api/addpassword', handler: 'api_addpassword_handler' },
    { path: '/api/changepassword', handler: 'api_changepassword_handler' }
];

exports.on_destroy = function() {
};


exports.isAuthenticated = function( req ) {
    if ( typeof req.session !== 'undefined' && typeof req.session.authenticated !== 'undefined' ) {
        return req.session.authenticated === true;
    }
    return false;
};

exports.isConfigured = function() {
    if ( typeof coderlib.device.name !== 'undefined' && coderlib.device.name !== '' &&
            typeof coderlib.device.hostname !== 'undefined' && coderlib.device.hostname !== '' ) {
        return true;
    } else {
        return false;
    }
};

exports.hasPassword = function() {
    if ( typeof coderlib.device.password_hash !== 'undefined' && coderlib.device.password_hash !== '' ) {
        return true;
    } else {
        return false;
    }
};

exports.authenticate = function( req, password ) {

    var authenticated = bcrypt.compareSync( password, coderlib.device.password_hash );
    if ( authenticated ) {
        req.session.authenticated = true;
    }

    return authenticated;
};

exports.logout = function( req ) {
    req.session.authenticated = false;
};


exports.index_handler = function( req, res ) {
    
    var firstuse = "?firstuse";
    if ( typeof( req.param('firstuse') ) === 'undefined' ) {
        firstuse = "";
    }
    
    if ( !exports.isConfigured() ) {
        res.redirect('/app/auth/configure?firstuse');
    } else if ( !exports.hasPassword() ) {
        res.redirect('/app/auth/addpassword?firstuse');
    } else if ( !exports.isAuthenticated(req) ) {
        res.redirect('/app/auth/login' + firstuse);
    } else {
        res.redirect('/app/coder' + firstuse);
    }
};

exports.addpassword_handler = function( req, res ) {
    var tmplvars = {};
    tmplvars['static_url'] = exports.settings.staticurl;
    tmplvars['app_name'] = exports.settings.appname;
    tmplvars['app_url'] = exports.settings.appurl;
    tmplvars['device_name'] = coderlib.device.name;
    tmplvars['page_mode'] = "addpassword";

    //only allow this step if they have not yet set a password
    if ( !exports.hasPassword() ) {
        res.render( exports.settings.viewpath + '/index', tmplvars );
    } else {
        res.redirect('/app/auth/login');
    }
};

exports.changepassword_handler = function( req, res ) {
    var tmplvars = {};
    tmplvars['static_url'] = exports.settings.staticurl;
    tmplvars['app_name'] = exports.settings.appname;
    tmplvars['app_url'] = exports.settings.appurl;
    tmplvars['device_name'] = coderlib.device.name;
    tmplvars['page_mode'] = "changepassword";

    //only allow this step if they are authenticated
    if ( exports.isAuthenticated(req) ) {
        res.render( exports.settings.viewpath + '/index', tmplvars );
    } else {
        res.redirect('/app/auth/login');
    }
};

exports.configure_handler = function( req, res ) {
    var tmplvars = {};
    tmplvars['static_url'] = exports.settings.staticurl;
    tmplvars['app_name'] = exports.settings.appname;
    tmplvars['app_url'] = exports.settings.appurl;
    tmplvars['device_name'] = coderlib.device.name;
    tmplvars['page_mode'] = "configure";

    //only allow this step if they are authenticated or have not yet set a password
    if ( exports.isAuthenticated(req) || !exports.hasPassword() ) {
        res.render( exports.settings.viewpath + '/index', tmplvars );
    } else {
        res.redirect('/app/auth/login');
    }
};

exports.api_addpassword_handler = function( req, res ) {

    //only allow this step if they have not yet set a password
    if ( exports.hasPassword() ) {
        res.json({
            status: "error",
            error: "not authenticated"
        });
        return;
    }

    var pass = req.param('password');
    var err = checkValidPassword(pass);

    if ( err ) {
        res.json({
            status: 'error', 
            error: err
        });
        return;
    }

    var spawn = require('child_process').spawn;
    var err=0;
    var erroutput = "";
    var output = "";
    //var setpipass = process.cwd() + '/sudo_scripts/setpipass';
    //var setpass = spawn( '/usr/bin/sudo', [setpipass] );
    //setpass.stdout.on( 'data', function( d ) {
    //    output += d;
    //});
    //setpass.stderr.on( 'data', function( d ) {
    //    erroutput += d;
    //});

    //setpass.addListener( 'exit', function( code, signal ) {
    var completed = function( code, signal ) {
        err = code;

        if ( err ) {
            res.json({
                status: "error",
                error: erroutput
            });
            return;
        }

        //TODO - Load hashed password
        var s = bcrypt.genSaltSync(10);
        var h = bcrypt.hashSync( pass, s );
        util.log("PASSWORD INITIALIZED");
        coderlib.device.password_hash = h;
        coderlib.device.save(function(err) {
            if ( !err ) {
                res.json({
                    status: "success"
                });
            } else {
                res.json({
                    status: "error",
                    error: "Could not save device settings."
                });
            }
        });
    };

    completed();

    //setpass.stdin.write(pass + '\n');
    //setpass.stdin.write(pass + '\n');
    //setpass.stdin.end();

};



exports.api_changepassword_handler = function( req, res ) {

    //only allow this step if they are authenticated
    if ( !exports.isAuthenticated(req) ) {
        res.json({
            status: "error",
            error: "not authenticated"
        });
        return;
    }

    var oldpass = req.param('oldpassword');
    var pass = req.param('password');

    //Make sure old pass is set and matches
    if ( typeof oldpass === 'undefined' || oldpass === "" 
            || !bcrypt.compareSync( oldpass, coderlib.device.password_hash ) ) {
        res.json({
            status: 'error', 
            error: "old password was incorrect" 
        });
        return;
    }

    var err = checkValidPassword(pass);

    if ( err ) {
        res.json({
            status: 'error', 
            error: err
        });
        return;
    }

    var spawn = require('child_process').spawn;
    var err=0;
    var erroutput = "";
    var output = "";
    //var setpipass = process.cwd() + '/sudo_scripts/setpipass';
    //var setpass = spawn( '/usr/bin/sudo', [setpipass] );
    //setpass.stdout.on( 'data', function( d ) {
    //    output += d;
    //});
    //setpass.stderr.on( 'data', function( d ) {
    //    erroutput += d;
    //});

    //setpass.addListener( 'exit', function( code, signal ) {
    var completed = function( code, signal ) {
        err = code;


        if ( err ) {
            res.json({
                status: "error",
                error: erroutput
            });
            return;
        }

        //TODO - Load hashed password
        var s = bcrypt.genSaltSync(10);
        var h = bcrypt.hashSync( pass, s );
        util.log("PASSWORD INITIALIZED");
        coderlib.device.password_hash = h;
        coderlib.device.save(function(err) {
            if ( !err ) {
                res.json({
                    status: "success"
                });
            } else {
                res.json({
                    status: "error",
                    error: "Could not save device settings."
                });
            }
        });
    };

    completed();

    //setpass.stdin.write(pass + '\n');
    //setpass.stdin.write(pass + '\n');
    //setpass.stdin.end();
};


exports.login_handler = function( req, res ) {
    var tmplvars = {};
    tmplvars['static_url'] = exports.settings.staticurl;
    tmplvars['app_name'] = exports.settings.appname;
    tmplvars['app_url'] = exports.settings.appurl;
    tmplvars['device_name'] = coderlib.device.name;
    tmplvars['page_mode'] = "login";


    //TODO - should this log you out automatically?
    req.session.authenticated = false;
    res.render( exports.settings.viewpath + '/index', tmplvars );
};

exports.logout_handler = function( req, res ) {
    var tmplvars = {};
    tmplvars['static_url'] = exports.settings.staticurl;
    tmplvars['app_name'] = exports.settings.appname;
    tmplvars['app_url'] = exports.settings.appurl;
    tmplvars['device_name'] = coderlib.device.name;
    tmplvars['page_mode'] = "logout";

    req.session.authenticated = false;
    res.render( exports.settings.viewpath + '/index', tmplvars );
};

exports.api_login_handler = function( req, res ) {
    if ( typeof req.body.password !== 'undefined' && req.body.password !== "" ) {
        var authenticated = exports.authenticate( req, req.body.password );
        if ( authenticated === true ) {
            res.json( { status: 'success'} );
            return;
        }
    } 
    res.json( { 
        status: 'error',
        error: 'invalid password'
    } );
};

exports.api_logout_handler = function( req, res ) {
    req.session.authenticated = false;

    res.json( { status: 'success'} );
};

var checkValidPassword = function( pass ) {
    if ( !pass || pass === '' ) {
        return "the password is empty";
    }

    if ( pass.length < 6 ) {
        return "the password should contain at least 6 characters";
    }

    if ( !pass.match(/[a-z]/) ||
            !pass.match(/[A-Z0-9\-\_\.\,\;\:\'\"\[\]\{\}\!\@\#\$\%\^\&\*\(\)\\].*[A-Z0-9\-\_\.\,\;\:\'\"\[\]\{\}\!\@\#\$\%\^\&\*\(\)\\]/) ) {
        return "your password must contain a lower case letter and at least two upper case letters or numbers";
    }

    return null;
};





