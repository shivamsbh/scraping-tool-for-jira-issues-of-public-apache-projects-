const express = require('express');
const router = express.Router();
const Scraper = require('../services/scraper');
const logger = require('../utils/logger');

// Store scraper instance
let scraperInstance = null;
let isRunning = false;

/**
 * GET /api/status
 * Get current scraping status
 */
router.get('/status', (req, res) => {
  if (!scraperInstance) {
    return res.json({
      status: 'idle',
      message: 'No scraping operation in progress',
      isRunning: false
    });
  }

  const stats = scraperInstance.getStats();
  res.json({
    status: isRunning ? 'running' : 'completed',
    isRunning,
    stats
  });
});

/**
 * POST /api/start
 * Start scraping operation
 */
router.post('/start', async (req, res) => {
  if (isRunning) {
    return res.status(400).json({
      error: 'Scraping operation already in progress'
    });
  }

  try {
    scraperInstance = new Scraper();
    isRunning = true;

    // Send immediate response
    res.json({
      message: 'Scraping started',
      status: 'running'
    });

    // Run scraping in background
    scraperInstance.scrapeAll()
      .then(stats => {
        isRunning = false;
        logger.info('Scraping completed successfully');
      })
      .catch(error => {
        isRunning = false;
        logger.error('Scraping failed:', error);
      });

  } catch (error) {
    isRunning = false;
    logger.error('Failed to start scraping:', error);
    res.status(500).json({
      error: 'Failed to start scraping',
      message: error.message
    });
  }
});

/**
 * POST /api/stop
 * Stop scraping operation (graceful shutdown)
 */
router.post('/stop', (req, res) => {
  if (!isRunning) {
    return res.status(400).json({
      error: 'No scraping operation in progress'
    });
  }

  // Note: This is a simple flag. In production, implement proper cancellation
  isRunning = false;
  
  res.json({
    message: 'Scraping will stop after current batch',
    status: 'stopping'
  });
});

/**
 * GET /api/stats
 * Get detailed statistics
 */
router.get('/stats', (req, res) => {
  if (!scraperInstance) {
    return res.status(404).json({
      error: 'No scraping data available'
    });
  }

  const stats = scraperInstance.getStats();
  res.json(stats);
});

module.exports = router;
