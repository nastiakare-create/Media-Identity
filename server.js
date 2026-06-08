const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  : null;

async function initDb() {
  if (!pool) {
    console.warn('DATABASE_URL is not set. Database features are disabled.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

initDb().catch((error) => {
  console.error('Failed to initialize database:', error);
});

app.get('/api/messages', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database is not configured.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, message, created_at FROM messages ORDER BY created_at DESC LIMIT 20'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

app.post('/api/messages', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database is not configured.' });
  }

  const { name, email, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO messages (name, email, message) VALUES ($1, $2, $3) RETURNING id, name, email, message, created_at',
      [name, email || null, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save message.' });
  }
});

app.get('/api/health', async (req, res) => {
  if (!pool) {
    return res.json({ status: 'no-database' });
  }

  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', error: 'Database check failed.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
