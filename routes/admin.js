const express = require('express');
const router = express.Router();
// IMPORTANT: db is now a PromisePool from 'mysql2/promise'
const db = require('../db/connection');

// 1. Define BASE_URL
const BASE_URL = process.env.BASE_URL || '/';

// Helper function for PHP-style success alerts and redirects (moved from books.js for use here)
const sendSuccessRedirect = (res, message, redirectPath = `${BASE_URL}admin/dashboard`) => {
    return res.send(`
        <script>
            alert('${message}');
            window.location.href='${redirectPath}';
        </script>
    `);
};

// Middleware to check admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        // Set isAdmin for the EJS template to consume
        req.userIsAdmin = true; 
        return next();
    }
    return res.status(403).render('403'); // Forbidden page
}

// Helper function to render the ADD BOOKS form again with an error message and re-populated fields
const renderAddBooksForm = (req, res, msg, data = {}) => {
    res.render('admin/add-books', {
        user: req.session.user,
        BASE_URL: BASE_URL,
        message: msg,
        isbn: data.isbn || '',
        bookName: data.bookName || '',
        authorName: data.authorName || '',
        publisherName: data.publisherName || '',
        quantity: data.quantity || '1'
    });
};

// Helper function to render the REMOVE BOOKS form again with errors and data (NEW HELPER)
const renderRemoveBooksForm = (req, res, msg, msg2, data = {}) => {
    res.render('admin/remove-books', {
        user: req.session.user,
        BASE_URL: BASE_URL,
        // Crucial fix for ReferenceError in EJS:
        isAdmin: true,
        message: msg,
        message2: msg2,
        isbn: data.isbn || '',
        bookName: data.bookName || '',
        authorName: data.authorName || '',
        publisherName: data.publisherName || '',
        quantity: data.quantity || '1',
    });
};


// =======================================================
// ✅ GET Route to Display Add Books Form
// =======================================================
router.get('/admin/add-books', isAdmin, (req, res) => {
    renderAddBooksForm(req, res, '');
});

// =======================================================
// ✅ POST Route to Handle Add Books Submission
// =======================================================
router.post('/admin/add-books', isAdmin, async (req, res) => {
    const { isbn, bookName, authorName, publisherName, quantity } = req.body;

    try {
        // ... (existing logic for adding books remains here) ...
        const [rows] = await db.query('SELECT book_name, author_name, publisher_name FROM books WHERE isbn = ?', [isbn]);

        if (rows.length > 0) {
            const bookDetails = rows[0];

            // 🌟 FIX: Apply .trim() and .toLowerCase() for robust comparison
            const dbBookName = (bookDetails.book_name || '').trim().toLowerCase();
            const formBookName = (bookName || '').trim().toLowerCase();
            const dbAuthorName = (bookDetails.author_name || '').trim().toLowerCase();
            const formAuthorName = (authorName || '').trim().toLowerCase();
            const dbPublisherName = (bookDetails.publisher_name || '').trim().toLowerCase();
            const formPublisherName = (publisherName || '').trim().toLowerCase();

            // 1a. Book exists: Check if entered details match
            if (dbBookName === formBookName &&
                dbAuthorName === formAuthorName &&
                dbPublisherName === formPublisherName) {
                // Details match: Prompt to update quantity
                return res.send(`
                    <script>
                        if (confirm('This book already exists in the library. Do you want to add more quantity of this book into the library?')) {
                            window.location.href = '${BASE_URL}admin/update-quantity?isbn=${isbn}&quantity=${quantity}';
                        } else {
                            window.location.href = '${BASE_URL}admin/add-books';
                        }
                    </script>
                `);
            } else {
                // 1b. Book exists but details don't match
                const message = "Book details don't match with ISBN. Please enter the correct ISBN or check the book details.";
                return renderAddBooksForm(req, res, message, req.body);
            }
        } else {
            // 2. Book does not exist: Insert new book
            const sql = 'INSERT INTO books (isbn, book_name, author_name, publisher_name, available, borrowed) VALUES (?, ?, ?, ?, ?, ?)';
            await db.query(sql, [isbn, bookName, authorName, publisherName, quantity, 0]);

            // Success: Alert and redirect
            return sendSuccessRedirect(res, 'Book(s) added successfully', `${BASE_URL}admin/dashboard`);
        }

    } catch (error) {
        // Handle database or server errors
        console.error("Database Error:", error);
        const message = "An unexpected error occurred while processing your request. Please check server logs for details.";
        return renderAddBooksForm(req, res, message, req.body);
    }
});

// =======================================================
// ✅ Update Quantity (FINAL IMPLEMENTATION)
// =======================================================
router.get('/admin/update-quantity', isAdmin, async (req, res) => {
    // ... (existing update-quantity logic) ...
    const isbn = req.query.isbn;
    const quantity = parseInt(req.query.quantity) || 1; 

    const sql = 'UPDATE books SET available = available + ? WHERE isbn = ?';

    try {
        await db.query(sql, [quantity, isbn]);

        return res.send(`
            <script>
                alert('${quantity} book(s) added successfully to existing inventory (ISBN: ${isbn})!');
                window.location.href='${BASE_URL}admin/dashboard'; 
            </script>
        `);
    } catch (error) {
        console.error("Update Quantity DB Error:", error);
        return res.status(500).send(`
            <script>
                alert('Error updating book quantity. Check server logs.');
                window.location.href='${BASE_URL}admin/add-books';
            </script>
        `);
    }
});


// =======================================================
// ✅ Manage Inventory
// =======================================================
router.get('/admin/manage-inventory', isAdmin, async (req, res) => {
    // ... (existing manage-inventory logic) ...
    const sql = "SELECT * FROM books ORDER BY book_name ASC";

    try {
        const [results] = await db.query(sql);

        res.render("admin/manage-inventory", {
            user: req.session.user,
            books: results,
            BASE_URL: BASE_URL
        });
    } catch (err) {
        console.error("DB error:", err);
        return res.status(500).send("Database error");
    }
});

// =======================================================
// ✅ View Members
// =======================================================
router.get('/admin/view-members', isAdmin, (req, res) => {
    res.render('admin/view-members', {
        user: req.session.user,
        BASE_URL: BASE_URL
    });
});

// =======================================================
// ✅ Remove Books (GET) - FIX APPLIED HERE
// =======================================================
router.get('/admin/remove-books', isAdmin, (req, res) => {
    // The previous error was here. We need to pass all expected variables.
    renderRemoveBooksForm(req, res, '', '', req.query);
});

// =======================================================
// ✅ Remove Books (POST) - NEW LOGIC INTEGRATED
// =======================================================
router.post('/admin/remove-books', isAdmin, async (req, res) => {
    const { isbn, bookName, authorName, publisherName, quantity } = req.body;
    const qty = parseInt(quantity, 10);

    let message = ""; // For ISBN/details errors
    let message2 = ""; // For quantity errors

    try {
        // 1. Check if book exists
        const [rows] = await db.query('SELECT * FROM books WHERE isbn = ?', [isbn]);

        if (rows.length === 0) {
            message = "Invalid request! This book does not exist in the library.";
            return renderRemoveBooksForm(req, res, message, message2, req.body);
        }

        const bookDetails = rows[0];

        // 2. Validate Book Details Match (using the robust comparison from add-books)
        const dbBookName = (bookDetails.book_name || '').trim().toLowerCase();
        const formBookName = (bookName || '').trim().toLowerCase();
        const dbAuthorName = (bookDetails.author_name || '').trim().toLowerCase();
        const formAuthorName = (authorName || '').trim().toLowerCase();
        const dbPublisherName = (bookDetails.publisher_name || '').trim().toLowerCase();
        const formPublisherName = (publisherName || '').trim().toLowerCase();

        if (dbBookName !== formBookName || dbAuthorName !== formAuthorName || dbPublisherName !== formPublisherName) {
            message = "Book details doesn't match with ISBN. Please enter the correct ISBN or check the book details.";
            return renderRemoveBooksForm(req, res, message, message2, req.body);
        }

        const quantityAvailable = bookDetails.available;

        // 3. Validate Quantity
        if (qty <= 0 || isNaN(qty)) {
            message2 = "Invalid quantity entered. Quantity must be a positive number.";
            return renderRemoveBooksForm(req, res, message, message2, req.body);
        }

        if (qty > quantityAvailable) {
            message2 = `Invalid quantity entered. Quantity to remove (${qty}) is more than the available quantity (${quantityAvailable}).`;
            return renderRemoveBooksForm(req, res, message, message2, req.body);
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
                return sendSuccessRedirect(res, 'Book(s) removed successfully! (Available set to zero)');
            } else {
                // Delete the record entirely
                const sqlDelete = "DELETE FROM books WHERE isbn = ?";
                await db.query(sqlDelete, [isbn]);
                return sendSuccessRedirect(res, 'Book(s) permanently removed from library');
            }
        }

    } catch (error) {
        console.error("Database Error:", error);
        message = "An unexpected database error occurred during book removal.";
        return renderRemoveBooksForm(req, res, message, message2, req.body);
    }
});


module.exports = router;
