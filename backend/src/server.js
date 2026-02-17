require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { authRouter } = require('./routes/auth');
const { readersRouter } = require('./routes/readers');
const { publishersRouter } = require('./routes/publishers');
const { booksRouter } = require('./routes/books');
const { damageTypesRouter } = require('./routes/damageTypes');
const { borrowRouter } = require('./routes/borrow');
const { returnsRouter } = require('./routes/returns');
const { statsRouter } = require('./routes/stats');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/readers', readersRouter);
app.use('/api/publishers', publishersRouter);
app.use('/api/books', booksRouter);
app.use('/api/damage-types', damageTypesRouter);
app.use('/api/borrow', borrowRouter);
app.use('/api/return', returnsRouter);
app.use('/api/stats', statsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
