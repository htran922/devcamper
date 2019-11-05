const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check for authorization header can be accessed through req.headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Don't want the Bearer in the token so use split to get the token only
        token = req.headers.authorization.split(' ')[1];
    }

    // else if(req.cookies) {
    //     token = req.cookies.token
    // }

    // Make sure token exists
    if (!token) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log(decoded);

        req.user = await User.findById(decoded.id); 

        next();

    } catch (err) {
        return next(new ErrorResponse('Not authorized to access this route', 401));        
    }

});

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        // Check if role is included in currently logged in user 
        if (!roles.includes(req.user.role)) {
            return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));        
        }
        next();
    }
}