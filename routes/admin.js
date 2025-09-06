const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Middleware to check admin
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).render('403'); // Forbidden page
}

// ✅ Manage Inventory
router.get('/admin/manage-inventory', isAdmin, (req, res) => {
    const sql = "SELECT * FROM books ORDER BY title ASC";
    db.query("SELECT * FROM books ORDER BY title ASC", (err, results) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).send("Database error");
        }
        res.render("admin/manage-inventory", {
            user: req.session.user,
            books: results
        });
    });
});

// ✅ View Members
router.get('/admin/view-members', isAdmin, (req, res) => {
    res.render('admin/view-members', { user: req.session.user });
});

// ✅ Add Books
router.get('/admin/add-books', isAdmin, (req, res) => {
    res.render('admin/add-books', { user: req.session.user });
});

// ✅ Remove Books
router.get('/admin/remove-books', isAdmin, (req, res) => {
    res.render('admin/remove-books', { user: req.session.user });
});

module.exports = router;
