const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db/connection');

// Signup route
router.get('/signup', (req, res) => {
    res.render('signup');
});

router.post('/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, role],
        (err) => {
            if (err) return res.send('Error: ' + err);
            res.redirect('/login');
        }
    );
});

// Login route
router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                req.session.user = user;

                // Redirect by role
                if (user.role === 'admin') res.redirect('/admin/dashboard');
                else if (user.role === 'faculty') res.redirect('/faculty/dashboard');
                else res.redirect('/student/dashboard');
            } else {
                res.send('Incorrect password.');
            }
        } else {
            res.send('User not found.');
        }
    });
});

// Dashboards
router.get('/student/dashboard', (req, res) => {
    if (req.session.user?.role === 'student') {
        res.render('student-dashboard', { user: req.session.user });
    } else {
        res.redirect('/login');
    }
});

router.get('/faculty/dashboard', (req, res) => {
    if (req.session.user?.role === 'faculty') {
        res.render('faculty-dashboard', { user: req.session.user });
    } else {
        res.redirect('/login');
    }
});

router.get('/admin/dashboard', (req, res) => {
    if (req.session.user?.role === 'admin') {
        res.render('admin-dashboard', { user: req.session.user });
    } else {
        res.redirect('/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

module.exports = router;
