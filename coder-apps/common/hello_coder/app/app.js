/*

Hello Coder!

This is the Node.JS piece of your program. Unlike HTML, CSS, and JS,
this part of your program doesn't run in your web browser. Instead
it runs on your Raspberry Pi, and can do more advanced things like
save and retrieve data.  Coders call this "back end" or "server side"
software, and HTML, JS, and CSS code is "front end" or "client side"
software.

There are a ton of different languages for writing server side software, 
but Coder's built to use one system, called Node.JS. Node.JS uses
the Javascript language for making server-side code. Because it's
Javascript, when you get to writing back end code, you'll find that
it's very similar to what you've learned in front end JS.


WHAT'S GOING ON HERE
This program contains just the default back end code. The index_handler
function in this program is used to send your HTML code from the
server to your web browser. That's it!

Many demos in Coder look just like this in the Node.js file. To do
front end coding, you won't need to do a thing in Node. It's always
here, though, for when you get to making more advanced things.

If you're new to Coder, don't bother changing anything in here. Yet...

*/


exports.get_routes = [
    { path:'/', handler:'index_handler' },
];

exports.post_routes = [
];


exports.index_handler = function( app, req, res ) {
    res.render( app.view() );
};

exports.on_destroy = function() {
};



