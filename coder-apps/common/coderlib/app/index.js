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
var async = require('async');
var ncp = require('ncp').ncp;
var path = require('path');
var rimraf = require('rimraf');

exports.get_routes = [
    { path: '/api/app/list', handler: 'api_app_list_handler' },

    { path: '/api/device/name',  handler: 'api_get_device_name' },
    { path: '/api/device/owner', handler: 'api_get_device_owner' },
    { path: '/api/device/color', handler: 'api_get_device_color' }
];


exports.post_routes = [
    { path: '/api/device/name',  handler: 'api_set_device_name' },
    { path: '/api/device/owner', handler: 'api_set_device_owner' },
    { path: '/api/device/color', handler: 'api_set_device_color' }
];

exports.on_destroy = function() {
};

var app = require('./app');
exports.App       = app.App;
exports.LocalApp  = app.LocalApp;
exports.app       = app.LocalApp.find;
exports.listApps  = app.LocalApp.list;
exports.createApp = app.LocalApp.create;

exports.auth      = require('../../auth/app/index');


exports.device = function() {
    var devicefile = process.cwd() + "/device.json";

    var device = {
        password_hash: "",
        name: "Coder",
        hostname: "coder",
        owner: "Coder",
        color: "3e3e3e",

        loadSync: function() {
            try {
                var data = fs.readFileSync(devicefile, { encoding: "utf-8" });

                var info = JSON.parse(data);
                for (attr in device) {
                  if (typeof device[attr] !== 'function' && info[attr]) {
                    device[attr] = info[attr];
                  }
                }
            } catch (e) {
                return false;
            }

            return true;
        },

        save: function(callback) {
            var data = JSON.stringify(device);

            fs.writeFile(devicefile, data, { encoding: "utf-8" }, function (err) {
                if (callback) callback(err);
            });
        }
    }

    device.loadSync();

    return device;
}();

exports.api_app_list_handler = function( app, req, res ) {
    exports.listApps(function(err, results) {
      if (err) {
        res.send(500);
      }
      else {
        res.json({
            apps: results
        });
      }
    });
};

exports.api_get_device_name = function(app, req, res) {
  res.json({ name: exports.device.name });
}

exports.api_get_device_color = function(app, req, res) {
  res.json({ color: exports.device.color });
}

exports.api_get_device_owner = function(app, req, res) {
  res.json({ owner: exports.device.owner });
}

var hostnameFromDeviceName = function( name ) {
    var hostname = name;
    hostname = hostname.toLowerCase();
    hostname = hostname.replace(/[^a-z0-9\- ]/g, '');
    hostname = hostname.replace(/[\- ]+/g,'-');
    return hostname;
};

var isValidDeviceName = function( name ) {
    if ( !name || name === '' ) {
        return false;
    }
    //starts with an ascii word char. can contain word char's spaces and '
    if ( !name.match(/^[a-zA-Z0-9][\w ']*$/) ) {
        return false;
    }
    //ends in an ascii word char
    if ( !name.match(/[a-zA-Z0-9]$/) ) {
        return false;
    }
    return true;
};

exports.api_set_device_name = function(app, req, res) {
  if (isValidDeviceName(req.body.name))
  {
    exports.device.name = req.body.name;
    exports.device.hostname = hostnameFromDeviceName( req.body.name );

    exports.device.save(function(err) {
      if (err)
        res.json({ status: 'error', error: err });
      else
        res.json({ status: 'success', name: exports.device.name });
    });
  }
  else
    res.json({ status: 'error', error: '' });
}

var isValidColor = function( color ) {
    if ( !color || color === '' ) {
        return false;
    }
    color = color.toLowerCase();
    if ( !color.match(/^\#[a-f0-9]{6}$/) ) {
        return false;
    }
    return true;
}

exports.api_set_device_color = function(app, req, res) {
  if (isValidColor(req.body.color))
  {
    exports.device.color = req.body.color;
    exports.device.save(function(err) {
      if (err)
        res.json({ status: 'error', error: err });
      else
        res.json({ status: 'success', color: exports.device.color });
    });
  }
  else
    res.json({ status: 'error', error: '' });
}

exports.api_set_device_owner = function(app, req, res) {
  if (req.body.owner)
  {
    exports.device.owner = req.body.owner;
    exports.device.save(function(err) {
      if (err)
        res.json({ status: 'error', error: err });
      else
        res.json({ status: 'success', owner: exports.device.owner });
    });
  }
  else
    res.json({ status: 'error', error: '' });
}

