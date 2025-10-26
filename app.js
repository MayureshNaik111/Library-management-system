const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const favicon = require("serve-favicon");

// Initialize app
const app = express();

app.use(favicon(path.join(__dirname, 'public', 'open-book.png')));

// Body parser
app.use(express.urlencoded({ extended: true }));

app.use(express.json({ limit: '10mb' })); // Added for profile pictures uploads

// Database connection
const db = require('./db/connection');

const options = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'library_db'
};


const sessionStore = new MySQLStore(options);
// Session setup 
app.use(session({
    key: 'library_session',
    secret: 'your_secret_key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
// 💡 CRITICAL FIX: Use path.join(__dirname, 'public') to ensure Express 
// reliably finds the 'public' directory regardless of the current working directory.
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root to login 
app.get('/', (req, res) => {
    if (req.session.user) {
        const role = req.session.user.role;
        if (role === 'admin') res.redirect('/admin/dashboard');
        else if (role === 'faculty') res.redirect('/faculty/dashboard');
        else res.redirect('/student/dashboard');
    } else {
        res.redirect('/login');
    }
});

// Mount routes 
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

const bookRoutes = require('./routes/books');
app.use('/books', bookRoutes);

const profileRoutes = require('./routes/profile');
app.use('/', profileRoutes);

const adminRoutes = require('./routes/admin');
app.use('/', adminRoutes);

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});