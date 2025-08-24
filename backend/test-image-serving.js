const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Serve static files from uploads directory
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Image serving test server is running',
    testImageUrl: 'http://localhost:3001/api/uploads/placeholder.png'
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Test image URL: http://localhost:${PORT}/api/uploads/placeholder.png`);
});
