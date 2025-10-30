const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const favicon = require("serve-favicon");

// Initialize app
const app = express();

// ==============================================
// 🌟 CRITICAL FIX: STATIC FILES MUST COME FIRST
// ==============================================

// 1. Serve favicon
app.use(favicon(path.join(__dirname, 'public', 'open-book.png')));

// 2. Explicitly map '/assets' to the 'public/assets' folder
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// 3. Serve the entire 'public' directory from the root
app.use(express.static(path.join(__dirname, 'public')));

// 4. Configure view engine (AFTER static setup)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 5. Body parsers (Can go here or before routes)
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' })); 

// ... (Database and Session setup remains here) ...

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

// Mount routes (NOW DEFINED LAST)
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