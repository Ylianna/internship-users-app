import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

function getUniqIdValue() {
    return Math.random().toString(36).substring(2, 15);
}

const checkUserStatus = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'The user is not authorized.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userRes = await pool.query('SELECT id, status FROM users WHERE id = $1', [decoded.id]);

        if (userRes.rows.length === 0) {
            return res.status(403).json({ error: 'Your account has been deleted.', forceLogout: true });
        }

        if (userRes.rows[0].status === 'blocked') {
            return res.status(403).json({ error: 'Your account is blocked.', forceLogout: true });
        }

        req.user = userRes.rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid session token.' });
    }
};

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await pool.query(
            'INSERT INTO users (name, email, password_hash, status) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status',
            [name, email, passwordHash, 'unverified']
        );

        const user = newUser.rows[0];

        const verifyLink = `${process.env.BASE_URL || 'http://localhost:5050'}/api/auth/verify?id=${user.id}`;
        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Registration confirmation',
            html: `<p>Hello, ${user.name}! Click <a href="${verifyLink}">here</a> to activate your account.</p>`
        }).catch(err => console.error('Error sending email:', err.message));

        return res.status(201).json({ message: 'Registration successful! Email sent.', user });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A user with this email is already registered in the system!' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error.' });
    }
});

app.get('/api/auth/verify', async (req, res) => {
    const { id } = req.query;
    try {
        await pool.query(
            "UPDATE users SET status = 'active' WHERE id = $1 AND status = 'unverified'",
            [id]
        );
        return res.send('<h3>Your account has been successfully activated! You can now log in to the app.</h3>');
    } catch (err) {
        return res.status(500).send('Activation error.');
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const user = userRes.rows[0];
        if (user.status === 'blocked') {
            return res.status(403).json({ error: 'Your account has been blocked. Access denied.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        return res.json({ token, user: { id: user.id, name: user.name, email: user.email, status: user.status } });
    } catch (err) {
        return res.status(500).json({ error: 'Server error during authorization.' });
    }
});


app.get('/api/users', checkUserStatus, async (req, res) => {
    try {
        const usersRes = await pool.query('SELECT id, name, email, status, last_login, created_at FROM users ORDER BY last_login DESC NULLS LAST');
        return res.json(usersRes.rows);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to load users.' });
    }
});

app.post('/api/users/block', checkUserStatus, async (req, res) => {
    const { ids } = req.body;
    try {
        await pool.query("UPDATE users SET status = 'blocked' WHERE id = ANY($1)", [ids]);
        return res.json({ message: 'Users have been successfully blocked.' });
    } catch (err) {
        return res.status(500).json({ error: 'Error while blocking.' });
    }
});

app.post('/api/users/unblock', checkUserStatus, async (req, res) => {
    const { ids } = req.body;
    try {
        await pool.query("UPDATE users SET status = 'active' WHERE id = ANY($1) AND status = 'blocked'", [ids]);
        return res.json({ message: 'Users have been successfully unblocked.' });
    } catch (err) {
        return res.status(500).json({ error: 'Error unlocking.' });
    }
});

app.post('/api/users/delete', checkUserStatus, async (req, res) => {
    const { ids } = req.body;
    try {
        await pool.query("DELETE FROM users WHERE id = ANY($1)", [ids]);
        return res.json({ message: 'Users successfully deleted.' });
    } catch (err) {
        return res.status(500).json({ error: 'Error while deleting.' });
    }
});

app.post('/api/users/delete-unverified', checkUserStatus, async (req, res) => {
    const { ids } = req.body;
    try {
        await pool.query("DELETE FROM users WHERE id = ANY($1) AND status = 'unverified'", [ids]);
        return res.json({ message: 'Unverified users have been removed.' });
    } catch (err) {
        return res.status(500).json({ error: 'Operation failed.' });
    }
});

const PORT = process.env.PORT || 5050;

async function startServer() {
    try {
        const client = await pool.connect();
        console.log('✅ Connection to PostgreSQL successfully established!');
        client.release();

        app.listen(PORT, () => {
            console.log(`🚀 The server is running and is holding the port stably ${PORT}`);
        });
    } catch (err) {
        console.error('❌ CRITICAL ERROR: Failed to start server!');
        console.error(err.message);
        process.exit(1);
    }
}

startServer();