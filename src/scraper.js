#!/usr/bin/env node

/**
 * Standalone scraper script
 * Run directly without Express server: node src/scraper.js
 */

const Scraper = require('./services/scraper');
const logger = require('./utils/logger');

async function main() {
  logger.info('Starting standalone scraper...');
  
  const scraper = new Scraper();
  
  try {
    const stats = await scraper.scrapeAll();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SCRAPING COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`Total Issues: ${stats.totalIssues}`);
    console.log(`Successful: ${stats.successfulIssues}`);
    console.log(`Failed: ${stats.failedIssues}`);
    console.log(`Total Comments: ${stats.totalComments}`);
    console.log(`Duration: ${new Date(stats.startTime).toLocaleString()} - ${new Date(stats.endTime).toLocaleString()}`);
    console.log('\nProject Stats:');
    
    Object.entries(stats.projects).forEach(([project, projectStats]) => {
      console.log(`\n  ${project}:`);
      console.log(`    Issues Processed: ${projectStats.issuesProcessed}`);
      console.log(`    Issues Failed: ${projectStats.issuesFailed}`);
      console.log(`    Comments Collected: ${projectStats.commentsCollected}`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    logger.error('Scraping failed:', error);
    console.error('\n❌ SCRAPING FAILED:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run
main();
