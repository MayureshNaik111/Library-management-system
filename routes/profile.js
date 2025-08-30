const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Create DB connection
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'library_db'
});

// Update profile picture
router.post('/update-profile-pic', async (req, res) => {
    try {

        if (!req.session.user) {
            return res.status(401).send('Not logged in');
        }

        const { image } = req.body;
        console.log("Received image length:", image?.length);

        if (!image) return res.status(400).send('No image provided');

        // Save Base64 string to database
        await db.query(
            'UPDATE users SET profilePic = ? WHERE id = ?',
            [image, req.session.user.id]
        );

        // Update session data
        req.session.user.profilePic = image;

        res.send('Profile picture updated successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// Admin dashboard rendering with fresh user data
router.get('/admin/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (rows.length) {
        res.render('admin-dashboard', { user: rows[0] }); // rows[0], not rows
    } else {
        res.redirect('/login');
    }
});

module.exports = router;
