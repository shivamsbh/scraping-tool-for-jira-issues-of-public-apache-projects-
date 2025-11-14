require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000
  },
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://issues.apache.org/jira',
    apiVersion: process.env.JIRA_API_VERSION || '2',
    projects: (process.env.JIRA_PROJECTS || 'KAFKA,SPARK,HADOOP').split(',').map(p => p.trim())
  },
  scraping: {
    maxResultsPerPage: parseInt(process.env.MAX_RESULTS_PER_PAGE) || 100,
    maxIssuesPerProject: parseInt(process.env.MAX_ISSUES_PER_PROJECT) || null,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS) || 2000,
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
    rateLimitDelayMs: parseInt(process.env.RATE_LIMIT_DELAY_MS) || 1000
  },
  output: {
    outputDir: process.env.OUTPUT_DIR || './output',
    checkpointDir: process.env.CHECKPOINT_DIR || './checkpoints'
  }
};

module.exports = config;
