const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db/connection'); // ASSUMED to be a promise-based connection

// Signup route
router.get('/signup', (req, res) => {
    res.render('signup');
});

// FIX: Convert signup POST to use async/await for better control flow
router.post('/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
        return res.send('All fields are required.');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Execute query using await/promise syntax
        // NOTE: If db.query does not support promises, you will need to promisify it or use a different library.
        await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );
        
        // Use return res.redirect for safe redirection
        return res.redirect('/login');
    } catch (err) {
        console.error("Signup DB Error:", err);
        // Handle unique constraint or other DB errors
        return res.send('Error: Could not create user. ' + (err.code || ''));
    }
});

// Login route
router.get('/login', (req, res) => {
    // If the user is already logged in, redirect them immediately
    if (req.session.user) {
        const role = req.session.user.role;
        if (role === 'admin') return res.redirect('/admin/dashboard');
        if (role === 'faculty') return res.redirect('/faculty/dashboard');
        return res.redirect('/student/dashboard');
    }
    res.render('login');
});


// Login POST route - FULLY CONVERTED TO ASYNC/AWAIT
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Use promise-based query syntax
        // Assuming db.query returns [results, fields] for promise connections
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]); 

        if (results.length > 0) {
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                // 1. Set the user session data
                req.session.user = user;

                // 2. Redirect by role and RETURN immediately
                if (user.role === 'admin') {
                    return res.redirect('/admin/dashboard'); 
                } else if (user.role === 'faculty') {
                    return res.redirect('/faculty/dashboard');
                } else {
                    return res.redirect('/student/dashboard');
                }
            } else {
                // Incorrect password (render login page with error, instead of plain text)
                return res.send('Incorrect password.'); 
            }
        } else {
            // User not found
            return res.send('User not found.');
        }
    } catch (err) {
        console.error("Login Error:", err);
        // Handle database/server errors
        return res.status(500).send('Server error during login.');
    }
});


// Dashboards (No changes needed, but including for completeness)
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

// Logout (No changes needed, but including for completeness)
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

module.exports = router;
