const express = require('express');
const router = express.Router();
// IMPORTANT: db is now a PromisePool from 'mysql2/promise'
const db = require('../db/connection');

// 1. Define BASE_URL
const BASE_URL = process.env.BASE_URL || '/';

// Middleware to check admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).render('403'); // Forbidden page
}

// Helper function to render the form again with an error message and re-populated fields
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

// =======================================================
// ✅ GET Route to Display Add Books Form
// =======================================================
router.get('/admin/add-books', isAdmin, (req, res) => {
    renderAddBooksForm(req, res, '');
});

// =======================================================
// ✅ POST Route to Handle Form Submission (Robust String Comparison Added)
// =======================================================
router.post('/admin/add-books', isAdmin, async (req, res) => {
    const { isbn, bookName, authorName, publisherName, quantity } = req.body;

    try {
        // 1. Check if the book ISBN already exists
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
            return res.send(`
                <script>
                    alert('Book(s) added successfully');
                    window.location.href='${BASE_URL}admin/dashboard';
                </script>
            `);
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
    // Get the ISBN and quantity from the URL query parameters
    const isbn = req.query.isbn;
    const quantity = parseInt(req.query.quantity) || 1; // Ensure quantity is an integer

    // We assume 'available' column holds the current stock count
    const sql = 'UPDATE books SET available = available + ? WHERE isbn = ?';

    try {
        // Execute the update query
        await db.query(sql, [quantity, isbn]);

        // After successful update, send a success message and redirect to the dashboard
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
// ✅ Manage Inventory (Converted to async/await)
// =======================================================
router.get('/admin/manage-inventory', isAdmin, async (req, res) => {
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
// ✅ Remove Books
// =======================================================
router.get('/admin/remove-books', isAdmin, (req, res) => {
    res.render('admin/remove-books', {
        user: req.session.user,
        BASE_URL: BASE_URL
    });
});

module.exports = router;