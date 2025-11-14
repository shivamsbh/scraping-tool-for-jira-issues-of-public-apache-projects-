#!/usr/bin/env node

/**
 * Simple test script to verify the setup
 */

const JiraClient = require('./services/jiraClient');
const DataTransformer = require('./services/dataTransformer');
const FileHandler = require('./utils/fileHandler');
const logger = require('./utils/logger');
const config = require('./config/config');

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Running Tests');
  console.log('='.repeat(60) + '\n');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Configuration
  console.log('Test 1: Configuration Loading');
  try {
    if (!config.jira.baseUrl) throw new Error('Missing base URL');
    if (!config.jira.projects || config.jira.projects.length === 0) {
      throw new Error('No projects configured');
    }
    console.log('✅ Configuration loaded successfully');
    console.log(`   Projects: ${config.jira.projects.join(', ')}`);
    passedTests++;
  } catch (error) {
    console.log('❌ Configuration test failed:', error.message);
    failedTests++;
  }

  // Test 2: Jira Connection
  console.log('\nTest 2: Jira Connection');
  try {
    const client = new JiraClient();
    const connected = await client.testConnection();
    if (!connected) throw new Error('Connection failed');
    console.log('✅ Successfully connected to Jira');
    passedTests++;
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
    failedTests++;
  }

  // Test 3: Fetch Sample Issue
  console.log('\nTest 3: Fetch Sample Issue');
  try {
    const client = new JiraClient();
    const project = config.jira.projects[0];
    const jql = `project = ${project} ORDER BY created DESC`;
    const result = await client.searchIssues(jql, 0, 1);
    
    if (!result.issues || result.issues.length === 0) {
      throw new Error('No issues found');
    }
    
    const issue = result.issues[0];
    console.log('✅ Fetched sample issue');
    console.log(`   Issue: ${issue.key}`);
    console.log(`   Title: ${issue.fields.summary}`);
    console.log(`   Status: ${issue.fields.status.name}`);
    passedTests++;
  } catch (error) {
    console.log('❌ Issue fetch test failed:', error.message);
    failedTests++;
  }

  // Test 4: Data Transformation
  console.log('\nTest 4: Data Transformation');
  try {
    const client = new JiraClient();
    const project = config.jira.projects[0];
    const jql = `project = ${project} ORDER BY created DESC`;
    const result = await client.searchIssues(jql, 0, 1);
    
    if (!result.issues || result.issues.length === 0) {
      throw new Error('No issues found');
    }
    
    const issue = result.issues[0];
    const transformed = DataTransformer.transformIssue(issue, []);
    
    if (!transformed.metadata || !transformed.metadata.issueKey) {
      throw new Error('Invalid transformation');
    }
    
    DataTransformer.validateData(transformed);
    
    console.log('✅ Data transformation successful');
    console.log(`   Generated ${transformed.qa_pairs.length} Q&A pairs`);
    console.log(`   Tasks: summarization, classification, qa_pairs, conversation`);
    passedTests++;
  } catch (error) {
    console.log('❌ Transformation test failed:', error.message);
    failedTests++;
  }

  // Test 5: File Operations
  console.log('\nTest 5: File Operations');
  try {
    await FileHandler.ensureDirectory('./tmp_rovodev_test');
    
    const testData = {
      metadata: { issueKey: 'TEST-1' },
      raw_content: { title: 'Test Issue' }
    };
    
    // Test checkpoint
    await FileHandler.saveCheckpoint('tmp_rovodev_TEST', {
      lastProcessedIndex: 0,
      timestamp: new Date().toISOString()
    });
    
    const checkpoint = await FileHandler.loadCheckpoint('tmp_rovodev_TEST');
    if (!checkpoint) throw new Error('Checkpoint not loaded');
    
    console.log('✅ File operations successful');
    
    // Cleanup
    const fs = require('fs').promises;
    await fs.rm('./tmp_rovodev_test', { recursive: true, force: true });
    await fs.unlink('./checkpoints/tmp_rovodev_TEST_checkpoint.json').catch(() => {});
    
    passedTests++;
  } catch (error) {
    console.log('❌ File operations test failed:', error.message);
    failedTests++;
  }

  // Test 6: HTML Stripping
  console.log('\nTest 6: HTML Stripping');
  try {
    const html = '<p>Hello <b>World</b></p>';
    const text = DataTransformer.stripHtml(html);
    
    if (text.includes('<') || text.includes('>')) {
      throw new Error('HTML not properly stripped');
    }
    
    if (!text.includes('Hello') || !text.includes('World')) {
      throw new Error('Content lost during stripping');
    }
    
    console.log('✅ HTML stripping works correctly');
    console.log(`   Input: ${html}`);
    console.log(`   Output: ${text}`);
    passedTests++;
  } catch (error) {
    console.log('❌ HTML stripping test failed:', error.message);
    failedTests++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60) + '\n');

  if (failedTests === 0) {
    console.log('🎉 All tests passed! You\'re ready to start scraping.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
