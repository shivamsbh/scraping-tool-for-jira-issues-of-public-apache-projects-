#!/usr/bin/env node

/**
 * Cleanup Script for Jira Scraper
 * 
 * Removes all scraping data to allow fresh scraping:
 * - Output JSONL files
 * - Checkpoint files
 * - Metadata files
 * - Log files
 * 
 * Usage: node clean.js
 */

const fs = require('fs');
const path = require('path');

const DIRS_TO_CLEAN = [
  'output',
  'checkpoints',
  'logs'
];

function deleteFilesInDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⏭️  Directory doesn't exist: ${dirPath}`);
    return 0;
  }

  const files = fs.readdirSync(dirPath);
  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      fs.unlinkSync(filePath);
      console.log(`  ✅ Deleted: ${filePath}`);
      deletedCount++;
    }
  });

  return deletedCount;
}

function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧹 JIRA SCRAPER CLEANUP SCRIPT');
  console.log('='.repeat(60) + '\n');

  let totalDeleted = 0;

  DIRS_TO_CLEAN.forEach(dir => {
    console.log(`\n📂 Cleaning directory: ${dir}/`);
    const deleted = deleteFilesInDirectory(dir);
    totalDeleted += deleted;
    
    if (deleted === 0) {
      console.log(`  ℹ️  No files to delete`);
    } else {
      console.log(`  ✨ Deleted ${deleted} file(s)`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ CLEANUP COMPLETE`);
  console.log(`Total files deleted: ${totalDeleted}`);
  console.log('='.repeat(60) + '\n');

  console.log('💡 You can now run a fresh scrape:');
  console.log('   npm run scrape\n');
}

// Run the cleanup
try {
  main();
} catch (error) {
  console.error('\n❌ Error during cleanup:', error.message);
  process.exit(1);
}
