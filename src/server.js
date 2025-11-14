const express = require('express');
const config = require('./config/config');
const logger = require('./utils/logger');
const scraperRoutes = require('./routes/scraperRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', scraperRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Jira Scraper API',
    version: '1.0.0',
    description: 'Apache Jira data scraper for LLM training data generation',
    endpoints: {
      health: 'GET /health',
      status: 'GET /api/status',
      start: 'POST /api/start',
      stop: 'POST /api/stop',
      stats: 'GET /api/stats'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API Status: http://localhost:${PORT}/api/status`);
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  console.log(`\n📚 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /api/status - Get scraping status`);
  console.log(`   POST /api/start - Start scraping`);
  console.log(`   POST /api/stop - Stop scraping`);
  console.log(`   GET  /api/stats - Get statistics\n`);
});

module.exports = app;
