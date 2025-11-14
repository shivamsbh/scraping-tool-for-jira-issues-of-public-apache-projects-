const logger = require('../utils/logger');

class DataTransformer {
  /**
   * Extract plain text from HTML/markup
   */
  static stripHtml(html) {
    if (!html) return '';
    // Basic HTML stripping - in production, consider using a library like 'he' or 'cheerio'
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Transform raw Jira issue to LLM training format
   */
  static transformIssue(issue, comments = []) {
    try {
      const fields = issue.fields || {};
      
      // Extract metadata
      const metadata = {
        issueKey: issue.key,
        issueId: issue.id,
        projectKey: fields.project?.key || 'UNKNOWN',
        projectName: fields.project?.name || 'Unknown Project',
        issueType: fields.issuetype?.name || 'Unknown',
        status: fields.status?.name || 'Unknown',
        priority: fields.priority?.name || 'Unknown',
        resolution: fields.resolution?.name || null,
        created: fields.created,
        updated: fields.updated,
        resolved: fields.resolutiondate,
        reporter: fields.reporter?.displayName || 'Unknown',
        assignee: fields.assignee?.displayName || 'Unassigned',
        labels: fields.labels || [],
        components: (fields.components || []).map(c => c.name),
        affectedVersions: (fields.versions || []).map(v => v.name),
        fixVersions: (fields.fixVersions || []).map(v => v.name)
      };

      // Extract text content
      const title = fields.summary || '';
      const description = this.stripHtml(fields.description || '');
      const commentsText = comments.map(c => ({
        author: c.author?.displayName || 'Unknown',
        created: c.created,
        body: this.stripHtml(c.body || '')
      }));

      // Generate training examples
      const trainingData = {
        metadata,
        raw_content: {
          title,
          description,
          comments: commentsText
        },
        
        // Task 1: Summarization
        summarization: {
          instruction: "Summarize the following issue from an Apache project.",
          input: `Title: ${title}\n\nDescription: ${description}`,
          context: `Project: ${metadata.projectName}, Type: ${metadata.issueType}, Status: ${metadata.status}`,
        },
        
        // Task 2: Classification
        classification: {
          instruction: "Classify the priority and type of this issue.",
          input: `${title}\n\n${description}`,
          labels: {
            priority: metadata.priority,
            type: metadata.issueType,
            status: metadata.status
          }
        },
        
        // Task 3: Question Answering
        qa_pairs: this.generateQAPairs(metadata, title, description, commentsText),
        
        // Task 4: Resolution prediction (if resolved)
        resolution: metadata.resolution ? {
          instruction: "Based on the issue description, predict if and how it might be resolved.",
          input: `${title}\n\n${description}`,
          output: metadata.resolution
        } : null,
        
        // Full conversation thread (for conversational AI training)
        conversation: this.buildConversationThread(title, description, commentsText)
      };

      return trainingData;
    } catch (error) {
      logger.error(`Error transforming issue ${issue.key}:`, error);
      throw error;
    }
  }

  /**
   * Generate Q&A pairs from issue data
   */
  static generateQAPairs(metadata, title, description, comments) {
    const pairs = [];

    // Basic metadata questions
    pairs.push({
      question: `What is the status of issue ${metadata.issueKey}?`,
      answer: metadata.status,
      context: title
    });

    pairs.push({
      question: `What is the priority of this issue?`,
      answer: metadata.priority,
      context: title
    });

    pairs.push({
      question: `Who is assigned to this issue?`,
      answer: metadata.assignee,
      context: title
    });

    // Content-based questions
    if (description) {
      pairs.push({
        question: `What is the description of issue ${metadata.issueKey}?`,
        answer: description,
        context: title
      });
    }

    if (comments.length > 0) {
      pairs.push({
        question: `How many comments does this issue have?`,
        answer: `${comments.length}`,
        context: title
      });
    }

    if (metadata.resolution) {
      pairs.push({
        question: `How was this issue resolved?`,
        answer: metadata.resolution,
        context: `${title}\n${description}`
      });
    }

    return pairs;
  }

  /**
   * Build conversation thread from issue and comments
   */
  static buildConversationThread(title, description, comments) {
    const thread = [
      {
        role: "user",
        content: `Issue: ${title}\n\n${description}`
      }
    ];

    comments.forEach((comment, index) => {
      thread.push({
        role: index % 2 === 0 ? "assistant" : "user",
        author: comment.author,
        timestamp: comment.created,
        content: comment.body
      });
    });

    return thread;
  }

  /**
   * Validate transformed data
   */
  static validateData(data) {
    if (!data.metadata || !data.metadata.issueKey) {
      throw new Error('Invalid data: missing issueKey');
    }
    
    if (!data.raw_content || !data.raw_content.title) {
      throw new Error('Invalid data: missing title');
    }

    return true;
  }
}

module.exports = DataTransformer;
