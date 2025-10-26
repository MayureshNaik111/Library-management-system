// C:\Users\reshm\Desktop\Demo\library-management\src\global\middleware.js

// This function checks if the user is an 'Admin'
exports.ensureAdmin = (req, res, next) => {
    // Assuming you are using 'express-session' and 'userType' is stored in the session
    if (req.session && req.session.userType === 'Admin') {
        return next(); // User is an Admin, proceed
    } else {
        // User is not an Admin, send a 403 Forbidden response
        res.status(403).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>403 Forbidden</title>
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        height: 100%;
                        width: 100%;
                        /* Note: Replace BASE_URL path with actual path to your image */
                        background: url("/assets/images/http403.jpg") no-repeat center center;
                        background-size: contain;
                        background-color: black;
                    }
                </style>
            </head>
            <body>
            </body>
            </html>
        `);
    }
};

// You can add other middleware functions here and export them too
// exports.someOtherMiddleware = (req, res, next) => { ... }