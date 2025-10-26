// Example Express route handler file (e.g., in /routes/books.js)
const express = require('express');
const router = express.Router();
// Assuming you have a connection pool/module for your database (e.g., MySQL)
const db = require('../db/connection'); // Adjust path as needed
const { ensureAdmin } = require('../src/global/middleware'); // Custom middleware

// Define your configuration variables (like BASE_URL)
const BASE_URL = process.env.BASE_URL || '/';

// --- GET Route: Display the Add Books Form ---
// Applies an admin-check middleware (ensureAdmin)
router.get('/add-books', ensureAdmin, (req, res) => {
    // Render the EJS file, passing initial values (often empty)
    res.render('add-books', {
        userId: req.session.userId, // Assuming session is handled by Express-session
        userType: req.session.userType,
        message: '',
        isbn: '',
        bookName: '',
        authorName: '',
        publisherName: '',
        quantity: '1',
        BASE_URL: BASE_URL // Pass config variables
    });
});

// --- POST Route: Handle Form Submission ---
router.post('/add-books', ensureAdmin, async (req, res) => {
    const { isbn, bookName, authorName, publisherName, quantity } = req.body;
    let message = "";

    // Repopulate form fields in case of an error
    const renderFormWithError = (msg) => {
        res.render('add-books', {
            userId: req.session.userId,
            userType: req.session.userType,
            message: msg,
            isbn, bookName, authorName, publisherName, quantity: quantity || '1',
            BASE_URL
        });
    };

    try {
        // 1. Check if book exists
        const [rows] = await db.query('SELECT * FROM books WHERE isbn = ?', [isbn]);

        if (rows.length > 0) {
            const bookDetails = rows[0];
            // Check if entered details match existing book
            if (bookDetails.bookName === bookName && bookDetails.authorName === authorName && bookDetails.publisherName === publisherName) {
                // Book exists, prompt to update quantity (requires client-side logic to handle this redirect)
                // In a proper Node/Express app, you would typically use a status code or a dedicated update route,
                // but mimicking the PHP logic:
                return res.send(`
                    <script>
                        if (confirm('This book already exists in the library. Do you want to add more quantity of this book into the library?')) {
                            window.location.href = '/books/update-quantity?isbn=${isbn}&quantity=${quantity}';
                        } else {
                            // Redirect back to the form if cancelled, or show message
                            window.location.href = '/books/add-books';
                        }
                    </script>
                `);
            } else {
                // Details don't match
                message = "Book details don't match with ISBN. Please enter the correct ISBN or check the book details.";
                return renderFormWithError(message);
            }
        } else {
            // 2. Book does not exist, insert new book
            const sql = 'INSERT INTO books (isbn, bookName, authorName, publisherName, available, borrowed) VALUES (?, ?, ?, ?, ?, ?)';
            await db.query(sql, [isbn, bookName, authorName, publisherName, quantity, 0]);

            // Success message and redirect
            // Use session flash messages for cleaner success notifications after redirect
            // e.g., req.flash('success', 'Book(s) added successfully');
            return res.send(`
                <script>
                    alert('Book(s) added successfully');
                    window.location.href='/adminDashboard'; // Adjust redirect path
                </script>
            `);
        }

    } catch (error) {
        console.error("Database Error:", error);
        message = "An error occurred while adding the book.";
        return renderFormWithError(message);
    }
});

// --- Middleware for Admin Check (Express equivalent of your PHP check) ---
// This should be in a separate file (e.g., src/global/middleware.js)
/*
exports.ensureAdmin = (req, res, next) => {
    // Assuming Express-session stores userType
    if (req.session && req.session.userType === 'Admin') {
        return next();
    } else {
        // Render the 403 Forbidden page or redirect to a login/error page
        // You can render a simple EJS file for 403
        res.status(403).render('403', { layout: false }); 
        // OR simply set status and send a message/HTML
        // res.status(403).send('403 Forbidden...');
    }
};
*/

// Don't forget to export the router
module.exports = router;