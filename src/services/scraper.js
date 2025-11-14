const JiraClient = require('./jiraClient');
const DataTransformer = require('./dataTransformer');
const FileHandler = require('../utils/fileHandler');
const logger = require('../utils/logger');
const config = require('../config/config');

class Scraper {
  constructor() {
    this.jiraClient = new JiraClient();
    this.stats = {
      totalIssues: 0,
      successfulIssues: 0,
      failedIssues: 0,
      totalComments: 0,
      startTime: null,
      endTime: null,
      projects: {}
    };
  }

  /**
   * Scrape a single project
   */
  async scrapeProject(projectKey) {
    logger.info(`Starting scrape for project: ${projectKey}`);
    
    const projectStats = {
      projectKey,
      issuesProcessed: 0,
      issuesFailed: 0,
      commentsCollected: 0,
      startTime: new Date().toISOString(),
      lastProcessedIssue: null
    };

    try {
      // Load checkpoint if exists
      const checkpoint = await FileHandler.loadCheckpoint(projectKey);
      const startAt = checkpoint ? checkpoint.lastProcessedIndex + 1 : 0;
      
      logger.info(`Starting from index ${startAt} for project ${projectKey}`);

      // Build JQL query
      const jql = `project = ${projectKey} ORDER BY created ASC`;
      
      let currentIndex = startAt;
      let hasMore = true;
      const maxIssues = config.scraping.maxIssuesPerProject;

      while (hasMore) {
        try {
          // Calculate how many issues to fetch in this batch
          let batchSize = config.scraping.maxResultsPerPage;
          if (maxIssues && (currentIndex + batchSize > maxIssues)) {
            batchSize = maxIssues - currentIndex;
          }

          // Stop if we've reached the limit
          if (maxIssues && currentIndex >= maxIssues) {
            logger.info(`Reached maximum issue limit of ${maxIssues} for project ${projectKey}`);
            hasMore = false;
            break;
          }

          // Fetch batch of issues
          const searchResult = await this.jiraClient.searchIssues(
            jql,
            currentIndex,
            batchSize
          );

          const { issues, total } = searchResult;
          
          logger.info(`Fetched ${issues.length} issues (${currentIndex} to ${currentIndex + issues.length} of ${total})`);

          if (!issues || issues.length === 0) {
            hasMore = false;
            break;
          }

          // Process each issue
          for (const issue of issues) {
            // Check if we've reached the limit
            if (maxIssues && currentIndex >= maxIssues) {
              logger.info(`Reached maximum issue limit of ${maxIssues} for project ${projectKey}`);
              hasMore = false;
              break;
            }

            try {
              await this.processIssue(issue, projectKey, projectStats);
              currentIndex++;
              
              // Save checkpoint every 10 issues
              if (currentIndex % 10 === 0) {
                await this.saveCheckpoint(projectKey, currentIndex, projectStats);
              }
            } catch (error) {
              logger.error(`Failed to process issue ${issue.key}:`, error.message);
              projectStats.issuesFailed++;
              this.stats.failedIssues++;
            }
          }

          // Check if there are more issues
          hasMore = hasMore && (currentIndex < total);

          if (!hasMore) {
            if (maxIssues && currentIndex >= maxIssues) {
              logger.info(`Completed scraping project ${projectKey}: processed ${currentIndex} issues (limit reached)`);
            } else {
              logger.info(`Completed scraping project ${projectKey}: processed ${currentIndex} of ${total} issues`);
            }
          }

        } catch (error) {
          logger.error(`Error fetching batch at index ${currentIndex}:`, error.message);
          
          // Save checkpoint before potentially stopping
          await this.saveCheckpoint(projectKey, currentIndex - 1, projectStats);
          
          // Decide whether to continue or stop
          if (error.response && error.response.status >= 400 && error.response.status < 500) {
            logger.error(`Client error, stopping scrape for ${projectKey}`);
            hasMore = false;
          } else {
            logger.warn(`Server/network error, will retry...`);
            // Continue to next iteration, retry logic in jiraClient will handle it
          }
        }
      }

      // Final checkpoint and metadata
      projectStats.endTime = new Date().toISOString();
      await this.saveCheckpoint(projectKey, currentIndex, projectStats);
      await FileHandler.saveMetadata(projectKey, projectStats);

      this.stats.projects[projectKey] = projectStats;
      
      logger.info(`Project ${projectKey} completed. Processed: ${projectStats.issuesProcessed}, Failed: ${projectStats.issuesFailed}`);
      
      return projectStats;

    } catch (error) {
      logger.error(`Fatal error scraping project ${projectKey}:`, error);
      throw error;
    }
  }

  /**
   * Process a single issue
   */
  async processIssue(issue, projectKey, projectStats) {
    try {
      logger.info(`Processing issue: ${issue.key}`);

      // Fetch comments
      let comments = [];
      try {
        const commentsData = await this.jiraClient.getComments(issue.key);
        comments = commentsData.comments || [];
        projectStats.commentsCollected += comments.length;
        this.stats.totalComments += comments.length;
      } catch (error) {
        logger.warn(`Failed to fetch comments for ${issue.key}:`, error.message);
        // Continue without comments
      }

      // Transform data
      const transformedData = DataTransformer.transformIssue(issue, comments);
      
      // Validate
      DataTransformer.validateData(transformedData);

      // Save to JSONL
      await FileHandler.appendToJsonl(projectKey, transformedData);

      projectStats.issuesProcessed++;
      projectStats.lastProcessedIssue = issue.key;
      this.stats.successfulIssues++;
      this.stats.totalIssues++;

      logger.info(`Successfully processed ${issue.key} with ${comments.length} comments`);

    } catch (error) {
      logger.error(`Error processing issue ${issue.key}:`, error);
      throw error;
    }
  }

  /**
   * Save checkpoint
   */
  async saveCheckpoint(projectKey, lastIndex, stats) {
    const checkpoint = {
      projectKey,
      lastProcessedIndex: lastIndex,
      lastProcessedIssue: stats.lastProcessedIssue,
      timestamp: new Date().toISOString(),
      stats: {
        issuesProcessed: stats.issuesProcessed,
        issuesFailed: stats.issuesFailed,
        commentsCollected: stats.commentsCollected
      }
    };

    await FileHandler.saveCheckpoint(projectKey, checkpoint);
  }

  /**
   * Scrape all configured projects
   */
  async scrapeAll() {
    this.stats.startTime = new Date().toISOString();
    
    logger.info(`Starting scrape for projects: ${config.jira.projects.join(', ')}`);

    // Test connection first
    const connected = await this.jiraClient.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Jira. Please check your configuration.');
    }

    for (const project of config.jira.projects) {
      try {
        await this.scrapeProject(project);
      } catch (error) {
        logger.error(`Failed to scrape project ${project}:`, error.message);
        // Continue with next project
      }
    }

    this.stats.endTime = new Date().toISOString();
    
    // Save overall stats
    await FileHandler.saveMetadata('_overall', this.stats);
    
    logger.info('Scraping completed!');
    logger.info(`Total issues: ${this.stats.totalIssues}, Successful: ${this.stats.successfulIssues}, Failed: ${this.stats.failedIssues}`);
    
    return this.stats;
  }

  /**
   * Get current stats
   */
  getStats() {
    return this.stats;
  }
}

module.exports = Scraper;
