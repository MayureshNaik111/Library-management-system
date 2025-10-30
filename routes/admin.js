const express = require('express');
const router = express.Router();
// IMPORTANT: db is now a PromisePool from 'mysql2/promise'
const db = require('../db/connection');

// 1. Define BASE_URL
const BASE_URL = '/'; 

// Helper function for PHP-style success alerts and redirects (IMPROVED for cleaner calls)
const sendSuccessRedirect = (res, message, redirectPath = 'admin/dashboard') => {
    return res.send(`
        <script>
            alert('${message}');
            window.location.href='${BASE_URL}${redirectPath}';
        </script>
    `);
};

// Middleware to check admin (CRITICAL FIX APPLIED)
function isAdmin(req, res, next) {
    // Check if user object exists AND role matches (using lowercase 'admin' as per original code)
    if (req.session.user && req.session.user.role === 'admin') { 
        req.userIsAdmin = true; 
        return next();
    }
    
    // Render the 403 Forbidden page if not admin
    return res.status(403).render('403', {
        user: req.session.user, // Pass user, even if undefined
        BASE_URL: BASE_URL
    }); 
}

// =======================================================
// 🚨 NEW API ENDPOINTS: Direct Inventory +/- 1 (Needed for manage-inventory.ejs)
// =======================================================

// API to increment available quantity by 1
router.post('/api/inventory/add-one', isAdmin, async (req, res) => {
    const { isbn } = req.body;
    
    try {
        const sql = 'UPDATE books SET available = available + 1 WHERE isbn = ?';
        await db.query(sql, [isbn]);
        
        // Respond with success. The frontend will handle the page refresh.
        res.json({ success: true, message: 'Quantity incremented by 1.' });
    } catch (error) {
        console.error("Add One DB Error:", error);
        res.status(500).json({ success: false, message: 'Database error while adding quantity.' });
    }
});

// API to decrement available quantity by 1
router.post('/api/inventory/remove-one', isAdmin, async (req, res) => {
    const { isbn } = req.body;
    
    try {
        // Check current quantity to prevent going below zero
        const [rows] = await db.query('SELECT available, borrowed FROM books WHERE isbn = ?', [isbn]);

        if (rows.length === 0 || rows[0].available <= 0) {
             return res.json({ success: false, message: 'Cannot remove. Available quantity is zero or book not found.' });
        }

        const sql = 'UPDATE books SET available = available - 1 WHERE isbn = ? AND available > 0';
        await db.query(sql, [isbn]);
        
        // Respond with success. The frontend will handle the page refresh.
        res.json({ success: true, message: 'Quantity decremented by 1.' });
    } catch (error) {
        console.error("Remove One DB Error:", error);
        res.status(500).json({ success: false, message: 'Database error while removing quantity.' });
    }
});


// =======================================================
// --- START: Existing Helper Functions and Routes (Unchanged logic) ---
// =======================================================

const buildMemberRowsHtml = (members) => {
    let rows = '';
    if (members.length > 0) {
        members.forEach((row, index) => {
            rows += `<tr>
                <td data-label='Sl.No.'>${index + 1}</td>
                <td data-label='User Type'>${row.role}</td>
                <td data-label='User Id'>${row.id}</td> 
                <td data-label='Name'>${row.name}</td> 
                </tr>`;
        });
    } else {
        rows = `<tr><td colspan='5'><center>There are no users registered yet or no results found...</center></td></tr>`;
    }
    return rows;
};


const renderAddBooksForm = (req, res, msg, data = {}) => {
    res.render('admin/add-books', {
        user: req.session.user,
        BASE_URL: BASE_URL,
        message: msg,
        isbn: data.isbn || '', 
        bookName: data.book_name || data.bookName || '', 
        authorName: data.author_name || data.authorName || '', 
        publisherName: data.publisher_name || data.publisherName || '', 
        quantity: data.quantity || '1'
    });
};

const renderRemoveBooksForm = (req, res, msg, msg2, data = {}) => {
    res.render('admin/remove-books', {
        user: req.session.user,
        BASE_URL: BASE_URL,
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

router.get('/admin/add-books', isAdmin, (req, res) => {
    renderAddBooksForm(req, res, '');
});

router.post('/admin/add-books', isAdmin, async (req, res) => {
    const { isbn, bookName, authorName, publisherName, quantity } = req.body;

    try {
        const [rows] = await db.query('SELECT book_name, author_name, publisher_name FROM books WHERE isbn = ?', [isbn]);

        if (rows.length > 0) {
            const bookDetails = rows[0];

            const dbBookName = (bookDetails.book_name || '').trim().toLowerCase();
            const formBookName = (bookName || '').trim().toLowerCase();
            const dbAuthorName = (bookDetails.author_name || '').trim().toLowerCase();
            const formAuthorName = (authorName || '').trim().toLowerCase();
            const dbPublisherName = (bookDetails.publisher_name || '').trim().toLowerCase();
            const formPublisherName = (publisherName || '').trim().toLowerCase();

            if (dbBookName === formBookName &&
                dbAuthorName === formAuthorName &&
                dbPublisherName === formPublisherName) {
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
                const message = "Book details don't match with ISBN. Please enter the correct ISBN or check the book details.";
                return renderAddBooksForm(req, res, message, req.body);
            }
        } else {
            const sql = 'INSERT INTO books (isbn, book_name, author_name, publisher_name, available, borrowed) VALUES (?, ?, ?, ?, ?, ?)';
            await db.query(sql, [isbn, bookName, authorName, publisherName, quantity, 0]);

            return sendSuccessRedirect(res, 'Book(s) added successfully', 'admin/dashboard');
        }

    } catch (error) {
        console.error("Database Error:", error);
        const message = "An unexpected error occurred while processing your request. Please check server logs for details.";
        return renderAddBooksForm(req, res, message, req.body);
    }
});

router.get('/admin/update-quantity', isAdmin, async (req, res) => {
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

router.get('/admin/view-members', isAdmin, async (req, res) => {
    const sql = "SELECT id, role, name, email FROM users ORDER BY id ASC";

    try {
        const [members] = await db.query(sql);

        res.render('admin/view-members', {
            user: req.session.user,
            BASE_URL: BASE_URL,
            members: members 
        });
    } catch (error) {
        console.error("View Members DB Error:", error);
        res.status(500).send("Database error while fetching members.");
    }
});

router.get('/api/admin/search-members', isAdmin, async (req, res) => {
    const query = req.query.query ? `%${req.query.query}%` : '%%';
    
    const sql = `
        SELECT id, role, name, email
        FROM users 
        WHERE id LIKE ? OR email LIKE ? OR role LIKE ? OR name LIKE ?
        ORDER BY id ASC
    `;

    try {
        const [members] = await db.query(sql, [query, query, query, query]);
        
        const htmlRows = buildMemberRowsHtml(members);
        res.send(htmlRows);

    } catch (error) {
        console.error("Search Members DB Error:", error);
        res.status(500).send("<tr><td colspan='8'><center>Search failed due to a server error.</center></td></tr>");
    }
});

router.get('/admin/remove-books', isAdmin, (req, res) => {
    renderRemoveBooksForm(req, res, '', '', req.query);
});

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
            return sendSuccessRedirect(res, 'Book(s) removed successfully', 'admin/dashboard');

        } else if (qty === quantityAvailable) {
            // Case 4b: Remove entirely
            if (bookDetails.borrowed > 0) {
                // Set available to 0 if still borrowed by someone
                const sqlUpdateZero = "UPDATE books SET available = 0 WHERE isbn = ?";
                await db.query(sqlUpdateZero, [isbn]);
                return sendSuccessRedirect(res, 'Book(s) removed successfully! (Available set to zero)', 'admin/dashboard');
            } else {
                // Delete the record entirely
                const sqlDelete = "DELETE FROM books WHERE isbn = ?";
                await db.query(sqlDelete, [isbn]);
                return sendSuccessRedirect(res, 'Book(s) permanently removed from library', 'admin/dashboard');
            }
        }

    } catch (error) {
        console.error("Database Error:", error);
        message = "An unexpected database error occurred during book removal.";
        return renderRemoveBooksForm(req, res, message, message2, req.body);
    }
});


module.exports = router;