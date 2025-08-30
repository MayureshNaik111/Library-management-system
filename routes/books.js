const express = require('express');
const router = express.Router();
const db = require('../db/connection');

router.get('/', (req, res) => {
    db.query('SELECT * FROM books', (err, results) => {
        if (err) throw err;
        res.render('index', { books: results });
    });
});

router.get('/add', (req, res) => {
    res.render('add-book');
});

router.post('/add', (req, res) => {
    const { title, author, isbn } = req.body;
    db.query('INSERT INTO books (title, author, isbn) VALUES (?, ?, ?)', [title, author, isbn], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

module.exports = router;
