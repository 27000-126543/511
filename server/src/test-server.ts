import express from 'express';
import http from 'http';

const app = express();
const server = http.createServer(app);

const PORT = 3001;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setTimeout(() => {
  console.log('Still running after 5 seconds');
}, 5000);
