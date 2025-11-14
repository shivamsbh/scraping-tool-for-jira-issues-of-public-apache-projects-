const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class JiraClient {
  constructor() {
    this.baseUrl = config.jira.baseUrl;
    this.apiVersion = config.jira.apiVersion;
    this.axiosInstance = axios.create({
      baseURL: `${this.baseUrl}/rest/api/${this.apiVersion}`,
      timeout: config.scraping.requestTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Sleep utility for rate limiting
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper with exponential backoff
   */
  async retryRequest(requestFn, retries = config.scraping.maxRetries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await requestFn();
        return response;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        // Handle specific error cases
        if (error.response) {
          const status = error.response.status;
          
          // Rate limiting (429)
          if (status === 429) {
            const retryAfter = error.response.headers['retry-after'] 
              ? parseInt(error.response.headers['retry-after']) * 1000 
              : config.scraping.retryDelayMs * Math.pow(2, attempt);
            
            logger.warn(`Rate limited (429). Waiting ${retryAfter}ms before retry ${attempt + 1}/${retries}`);
            
            if (!isLastAttempt) {
              await this.sleep(retryAfter);
              continue;
            }
          }
          
          // Server errors (5xx)
          if (status >= 500 && status < 600) {
            logger.warn(`Server error (${status}). Retry ${attempt + 1}/${retries}`);
            
            if (!isLastAttempt) {
              await this.sleep(config.scraping.retryDelayMs * Math.pow(2, attempt));
              continue;
            }
          }
          
          // Client errors (4xx) - don't retry except 429
          if (status >= 400 && status < 500 && status !== 429) {
            logger.error(`Client error (${status}): ${error.response.data?.errorMessages || error.message}`);
            throw error;
          }
        }
        
        // Network errors
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          logger.warn(`Request timeout. Retry ${attempt + 1}/${retries}`);
          
          if (!isLastAttempt) {
            await this.sleep(config.scraping.retryDelayMs * Math.pow(2, attempt));
            continue;
          }
        }
        
        // If last attempt or unhandled error, throw
        if (isLastAttempt) {
          logger.error(`Request failed after ${retries} retries: ${error.message}`);
          throw error;
        }
      }
    }
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(jql, startAt = 0, maxResults = config.scraping.maxResultsPerPage) {
    logger.info(`Searching issues: JQL="${jql}", startAt=${startAt}, maxResults=${maxResults}`);
    
    const response = await this.retryRequest(async () => {
      return await this.axiosInstance.get('/search', {
        params: {
          jql,
          startAt,
          maxResults,
          fields: '*all',
          expand: 'renderedFields,names,schema,operations,editmeta,changelog'
        }
      });
    });

    // Rate limiting between requests
    await this.sleep(config.scraping.rateLimitDelayMs);
    
    return response.data;
  }

  /**
   * Get issue details
   */
  async getIssue(issueKey) {
    logger.info(`Fetching issue: ${issueKey}`);
    
    const response = await this.retryRequest(async () => {
      return await this.axiosInstance.get(`/issue/${issueKey}`, {
        params: {
          fields: '*all',
          expand: 'renderedFields,names,schema,operations,editmeta,changelog'
        }
      });
    });

    await this.sleep(config.scraping.rateLimitDelayMs);
    
    return response.data;
  }

  /**
   * Get comments for an issue
   */
  async getComments(issueKey) {
    logger.info(`Fetching comments for issue: ${issueKey}`);
    
    const response = await this.retryRequest(async () => {
      return await this.axiosInstance.get(`/issue/${issueKey}/comment`);
    });

    await this.sleep(config.scraping.rateLimitDelayMs);
    
    return response.data;
  }

  /**
   * Get project information
   */
  async getProject(projectKey) {
    logger.info(`Fetching project info: ${projectKey}`);
    
    const response = await this.retryRequest(async () => {
      return await this.axiosInstance.get(`/project/${projectKey}`);
    });

    await this.sleep(config.scraping.rateLimitDelayMs);
    
    return response.data;
  }

  /**
   * Test connection to Jira
   */
  async testConnection() {
    try {
      // Try to search for a single issue as a connection test
      // This is more reliable than serverInfo which may not be available
      const response = await this.retryRequest(async () => {
        return await this.axiosInstance.get('/search', {
          params: {
            jql: 'order by created DESC',
            startAt: 0,
            maxResults: 1
          }
        });
      });
      logger.info('Successfully connected to Jira');
      return true;
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      logger.error(`Failed to connect to Jira: ${errorMsg}`);
      return false;
    }
  }
}

module.exports = JiraClient;
