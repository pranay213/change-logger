require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const commitController = require('./controllers/commitController');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.get('/api/commits', commitController.getCommits);
app.get('/api/changelog', commitController.getChangelog);
app.get('/api/branches', commitController.getBranches);
app.post('/api/changelog-file', commitController.createChangelogFile);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GitHub Commit Explorer API is running' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
