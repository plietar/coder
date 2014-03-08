
exports.listenIP = null; //Defaults to *
exports.cacheApps = true;

exports.httpListenPort = 8080; //this will all be redirected to SSL
exports.httpslistenPort = 8081; //the SSL port things run on

exports.httpVisiblePort = 80; //forwarded http port the user sees
exports.httpsVisiblePort = 443; //forwarded https port the user sees


//SSL Info
exports.ssl = {}
exports.ssl.enable = true
exports.ssl.country = "US";
exports.ssl.state = "New York";
exports.ssl.locale = "New York";
exports.ssl.commonName = "coder.local";
exports.ssl.subjectAltName = "DNS:192.168.0.1";


//Experimental
//
//Status Server
//  This can be used in conjundtion with the sample findcoder
//  appengine project. It allows multiple Coders on the same
//  NAT network to be discoverable. Coder devices will ping the
//  external server with their internal IP, and the server
//  will list the devices for any requesting machine that
//  originates from the same external IP.
exports.statusServer = '[yourpingserver].appspot.com';
exports.enableStatusServer = false;
