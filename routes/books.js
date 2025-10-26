const express = require('express');
const router = express.Router();
// Assuming you have a connection pool/module for your database (e.g., MySQL)
const db = require('../db/connection'); // Adjust path as needed
const { ensureAdmin } = require('../src/global/middleware'); // Custom middleware

// Define your configuration variables (like BASE_URL)
const BASE_URL = process.env.BASE_URL || '/';

// ----------------------------------------------------------------------
// --- Helper function for PHP-style success alerts and redirects ---
// ----------------------------------------------------------------------
const sendSuccessRedirect = (res, message, redirectPath = '/adminDashboard') => {
    return res.send(`
        <script>
            alert('${message}');
            window.location.href='${redirectPath}';
        </script>
    `);
};

// ----------------------------------------------------------------------
// --- ADD BOOKS ROUTES (/add-books) ---
// ----------------------------------------------------------------------

// --- GET Route: Display the Add Books Form ---
router.get('/add-books', ensureAdmin, (req, res) => {
    // Render the EJS file, passing initial values (often empty)
    res.render('add-books', {
        userId: req.session.userId, // Assuming session is handled by Express-session
        userType: req.session.userType,
        message: '',
        isbn: req.query.isbn || '',
        bookName: req.query.bookName || '',
        authorName: req.query.authorName || '',
        publisherName: req.query.publisherName || '',
        quantity: req.query.quantity || '1',
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
                return res.send(`
                    <script>
                        // NOTE: Using alert/confirm in production is discouraged. Consider a modal UI.
                        if (confirm('This book already exists in the library. Do you want to add more quantity of this book into the library?')) {
                            window.location.href = '/books/update-quantity?isbn=${isbn}&quantity=${quantity}';
                        } else {
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
            return sendSuccessRedirect(res, 'Book(s) added successfully');
        }

    } catch (error) {
        console.error("Database Error:", error);
        message = "An error occurred while adding the book.";
        return renderFormWithError(message);
    }
});


// ----------------------------------------------------------------------
// --- REMOVE BOOKS ROUTES (/remove-books) (New Logic) ---
// ----------------------------------------------------------------------

// --- GET Route: Display the Remove Books Form ---
router.get('/remove-books', ensureAdmin, (req, res) => {
    // Render the EJS file, passing initial values from query or defaults
    res.render('remove-books', {
        userId: req.session.userId,
        userType: req.session.userType,
        message: '', // book error
        message2: '', // quantity error
        isbn: req.query.isbn || '',
        bookName: req.query.bookName || '',
        authorName: req.query.authorName || '',
        publisherName: req.query.publisherName || '',
        quantity: req.query.quantity || '1',
        BASE_URL: BASE_URL,
        isAdmin: (req.session.userType === 'Admin') // EJS needs this for conditional rendering (if used)
    });
});

// --- POST Route: Handle Book Removal ---
router.post('/remove-books', ensureAdmin, async (req, res) => {
    const { isbn, bookName, authorName, publisherName, quantity } = req.body;
    const qty = parseInt(quantity, 10);

    let message = ""; // For ISBN/details errors
    let message2 = ""; // For quantity errors

    // Repopulate form fields in case of an error
    const renderFormWithError = (msg1, msg2) => {
        res.render('remove-books', {
            userId: req.session.userId,
            userType: req.session.userType,
            message: msg1,
            message2: msg2,
            isbn, bookName, authorName, publisherName, quantity: quantity || '1',
            BASE_URL,
            isAdmin: true
        });
    };

    try {
        // 1. Check if book exists
        const [rows] = await db.query('SELECT * FROM books WHERE isbn = ?', [isbn]);

        if (rows.length === 0) {
            message = "Invalid request! This book does not exist in the library.";
            return renderFormWithError(message, message2);
        }

        const bookDetails = rows[0];

        // 2. Validate Book Details Match
        if (bookDetails.bookName !== bookName || bookDetails.authorName !== authorName || bookDetails.publisherName !== publisherName) {
            message = "Book details doesn't match with ISBN. Please enter the correct ISBN or check the book details.";
            return renderFormWithError(message, message2);
        }

        const quantityAvailable = bookDetails.available;

        // 3. Validate Quantity
        if (qty <= 0 || isNaN(qty)) {
            message2 = "Invalid quantity entered. Quantity must be a positive number.";
            return renderFormWithError(message, message2);
        }

        if (qty > quantityAvailable) {
            // Deletion quantity requested is more than the quantity available
            message2 = "Invalid quantity entered. Quantity to remove is more than the available quantity.";
            return renderFormWithError(message, message2);
        }

        // 4. Perform Removal Logic
        if (qty < quantityAvailable) {
            // Case 4a: Decrease quantity
            const sqlUpdate = "UPDATE books SET available = available - ? WHERE isbn = ?";
            await db.query(sqlUpdate, [qty, isbn]);
            return sendSuccessRedirect(res, 'Book(s) removed successfully');

        } else if (qty === quantityAvailable) {
            // Case 4b: Remove entirely
            if (bookDetails.borrowed > 0) {
                // Set available to 0 if still borrowed by someone
                const sqlUpdateZero = "UPDATE books SET available = 0 WHERE isbn = ?";
                await db.query(sqlUpdateZero, [isbn]);
                return sendSuccessRedirect(res, 'Book(s) removed successfully!');
            } else {
                // Delete the record entirely
                const sqlDelete = "DELETE FROM books WHERE isbn = ?";
                await db.query(sqlDelete, [isbn]);
                return sendSuccessRedirect(res, 'Book(s) removed successfully');
            }
        }

    } catch (error) {
        console.error("Database Error:", error);
        // Fallback error message
        message = "An unexpected database error occurred during book removal.";
        return renderFormWithError(message, message2);
    }
});


// ----------------------------------------------------------------------
// --- API Route: Fetch Book Details by ISBN (Needed for client-side JS) ---
// The original PHP relied on `getBookDetailsByISBN.php`, here is the Express equivalent:
// ----------------------------------------------------------------------
router.post('/getBookDetailsByISBN', async (req, res) => {
    // Note: Assuming client-side JS sends JSON or URL-encoded data
    const isbn = req.body.isbn || req.query.isbn;

    if (!isbn || isbn.length !== 13) {
        return res.json({ success: false, message: 'Invalid ISBN format.' });
    }

    try {
        const [rows] = await db.query('SELECT bookName, authorName, publisherName FROM books WHERE isbn = ?', [isbn]);
        
        if (rows.length > 0) {
            const book = rows[0];
            return res.json({
                success: true,
                bookName: book.bookName,
                authorName: book.authorName,
                publisherName: book.publisherName
            });
        } else {
            return res.json({ success: false, message: 'Book not found.' });
        }

    } catch (error) {
        console.error("API Error fetching book details:", error);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});


// Don't forget to export the router
module.exports = router;
