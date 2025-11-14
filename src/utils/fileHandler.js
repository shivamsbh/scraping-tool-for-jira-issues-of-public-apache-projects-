const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class FileHandler {
  /**
   * Ensure directory exists, create if it doesn't
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Save checkpoint data
   */
  static async saveCheckpoint(project, data) {
    try {
      const config = require('../config/config');
      await this.ensureDirectory(config.output.checkpointDir);
      
      const checkpointPath = path.join(
        config.output.checkpointDir,
        `${project}_checkpoint.json`
      );
      
      await fs.writeFile(checkpointPath, JSON.stringify(data, null, 2));
      logger.info(`Checkpoint saved for project ${project}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save checkpoint for ${project}:`, error);
      throw error;
    }
  }

  /**
   * Load checkpoint data
   */
  static async loadCheckpoint(project) {
    try {
      const config = require('../config/config');
      const checkpointPath = path.join(
        config.output.checkpointDir,
        `${project}_checkpoint.json`
      );
      
      const data = await fs.readFile(checkpointPath, 'utf8');
      logger.info(`Checkpoint loaded for project ${project}`);
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info(`No checkpoint found for project ${project}, starting fresh`);
        return null;
      }
      logger.error(`Failed to load checkpoint for ${project}:`, error);
      throw error;
    }
  }

  /**
   * Append to JSONL file
   */
  static async appendToJsonl(project, data) {
    try {
      const config = require('../config/config');
      await this.ensureDirectory(config.output.outputDir);
      
      const outputPath = path.join(
        config.output.outputDir,
        `${project}_training_data.jsonl`
      );
      
      const jsonLine = JSON.stringify(data) + '\n';
      await fs.appendFile(outputPath, jsonLine);
      return true;
    } catch (error) {
      logger.error(`Failed to append to JSONL for ${project}:`, error);
      throw error;
    }
  }

  /**
   * Save metadata/stats
   */
  static async saveMetadata(project, metadata) {
    try {
      const config = require('../config/config');
      await this.ensureDirectory(config.output.outputDir);
      
      const metadataPath = path.join(
        config.output.outputDir,
        `${project}_metadata.json`
      );
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      logger.info(`Metadata saved for project ${project}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save metadata for ${project}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = FileHandler;
