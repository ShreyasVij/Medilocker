import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Use AI service logs directory for centralized logging
const LOG_DIR = join(process.cwd(), '..', 'ai', 'logs');

// Ensure logs directory exists
try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: any;
}

function formatLogEntry(entry: LogEntry): string {
  const timestamp = new Date().toISOString();
  let logLine = `${timestamp} | ${entry.level} | [${entry.tag}] ${entry.message}`;
  
  if (entry.data !== undefined) {
    logLine += ` | ${JSON.stringify(entry.data)}`;
  }
  
  return logLine + '\n';
}

function writeLog(filename: string, entry: LogEntry): void {
  try {
    const logPath = join(LOG_DIR, filename);
    const logLine = formatLogEntry(entry);
    appendFileSync(logPath, logLine, 'utf8');
  } catch (err) {
    // Fallback to console if file write fails
    console.error('Failed to write log:', err);
  }
}

export class ServerLogger {
  private filename: string;
  private tag: string;

  constructor(filename: string, tag: string) {
    this.filename = filename;
    this.tag = tag;
  }

  info(message: string, data?: any): void {
    writeLog(this.filename, {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      tag: this.tag,
      message,
      data
    });
  }

  warn(message: string, data?: any): void {
    writeLog(this.filename, {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      tag: this.tag,
      message,
      data
    });
  }

  error(message: string, data?: any): void {
    writeLog(this.filename, {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      tag: this.tag,
      message,
      data
    });
  }

  debug(message: string, data?: any): void {
    writeLog(this.filename, {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      tag: this.tag,
      message,
      data
    });
  }
}

// Create logger instances for different modules
export const reprocessLogger = new ServerLogger('reprocess.log', 'REPROCESS');
export const vitalsLogger = new ServerLogger('vitals.log', 'VITALS');
export const healthSummaryLogger = new ServerLogger('health_summary.log', 'HEALTH_SUMMARY');
