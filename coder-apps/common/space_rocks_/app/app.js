
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

