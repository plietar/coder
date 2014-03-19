exports.settings={};
//These are dynamically updated by the runtime
//settings.appname - the app id (folder) where your app is installed
//settings.viewpath - prefix to where your view html files are located
//settings.staticurl - base url path to static assets /static/apps/appname
//settings.appurl - base url path to this app /app/appname

exports.get_routes = [
    { path:'/', handler:'index_handler' },
];

exports.post_routes = [
];


exports.index_handler = function( req, res ) {
    res.render( app.view() );
};

exports.on_destroy = function() {
};
