import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

// Structured log entry format
export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  enableConsole: boolean;
  logDirectory: string;
  maxLogFiles: number;
  maxFileSizeMB: number;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableFileLogging: true,
  enableConsole: true,
  logDirectory: '',
  maxLogFiles: 5,
  maxFileSizeMB: 10,
};

class Logger {
  private config: LoggerConfig;
  private currentLogFile: string | null = null;
  private fileWriteStream: fs.WriteStream | null = null;
  private logRotationCheck: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set default log directory
    if (!this.config.logDirectory) {
      this.config.logDirectory = path.join(app.getPath('userData'), 'logs');
    }

    // Ensure log directory exists
    if (this.config.enableFileLogging && !fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }

    // Initialize log file
    if (this.config.enableFileLogging) {
      this.initializeLogFile();
      this.startLogRotation();
    }
  }

  private initializeLogFile(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(
      this.config.logDirectory,
      `odin-${timestamp}.log`
    );
    this.fileWriteStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
  }

  private startLogRotation(): void {
    // Check for log rotation every hour
    this.logRotationCheck = setInterval(() => {
      this.rotateLogsIfNeeded();
    }, 60 * 60 * 1000);
  }

  private rotateLogsIfNeeded(): void {
    if (!this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
      this.initializeLogFile();
      return;
    }

    const stats = fs.statSync(this.currentLogFile);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB >= this.config.maxFileSizeMB) {
      this.closeCurrentFile();
      this.cleanOldLogs();
      this.initializeLogFile();
    }
  }

  private cleanOldLogs(): void {
    const files = fs.readdirSync(this.config.logDirectory)
      .filter(f => f.startsWith('odin-') && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(this.config.logDirectory, f),
        mtime: fs.statSync(path.join(this.config.logDirectory, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Remove old logs beyond maxLogFiles
    if (files.length > this.config.maxLogFiles) {
      files.slice(this.config.maxLogFiles).forEach(f => {
        try {
          fs.unlinkSync(f.path);
        } catch (err) {
          console.warn(`[Logger] Failed to delete old log: ${f.name}`);
        }
      });
    }
  }

  private closeCurrentFile(): void {
    if (this.fileWriteStream) {
      this.fileWriteStream.end();
      this.fileWriteStream = null;
    }
    this.currentLogFile = null;
  }

  private formatLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    context?: Record<string, unknown>,
    stack?: string
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      category,
      message,
      ...(context && { context }),
      ...(stack && { stack }),
    };

    return JSON.stringify(entry);
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    context?: Record<string, unknown>,
    stack?: string
  ): void {
    if (level < this.config.level) return;

    const formattedEntry = this.formatLogEntry(level, category, message, context, stack);

    // Console output
    if (this.config.enableConsole) {
      const consoleMsg = `[${LOG_LEVEL_NAMES[level]}] [${category}] ${message}`;
      if (level === LogLevel.ERROR) {
        console.error(consoleMsg, context || '', stack || '');
      } else if (level === LogLevel.WARN) {
        console.warn(consoleMsg, context || '');
      } else {
        console.log(consoleMsg, context || '');
      }
    }

    // File output
    if (this.config.enableFileLogging && this.fileWriteStream) {
      this.fileWriteStream.write(formattedEntry + '\n');
    }
  }

  // Public logging methods
  debug(category: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  info(category: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  warn(category: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  error(category: string, message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const stack = error instanceof Error ? error.stack : undefined;
    const errorContext = error instanceof Error
      ? { ...context, errorMessage: error.message, errorName: error.name }
      : context;

    this.log(LogLevel.ERROR, category, message, errorContext, stack);
  }

  // Lifecycle
  shutdown(): void {
    if (this.logRotationCheck) {
      clearInterval(this.logRotationCheck);
      this.logRotationCheck = null;
    }
    this.closeCurrentFile();
  }

  // Configuration
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(config);
  }
  return loggerInstance;
}

export function createLogger(category: string) {
  const logger = getLogger();

  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      logger.debug(category, message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      logger.info(category, message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      logger.warn(category, message, context),
    error: (message: string, error?: Error | unknown, context?: Record<string, unknown>) =>
      logger.error(category, message, error, context),
  };
}

// Convenience function for quick logging
export const log = createLogger('App');
