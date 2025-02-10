export enum LogLevel {
  DEBUG = 1,
  INFO = 2,
  WARNING = 3,
  ERROR = 4
}

export class CustomLogger {
  private prefix: string;
  private logLevel: LogLevel = LogLevel.INFO;

  constructor(prefix: string = "[App]", level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.logLevel = level;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const metadata = args.length ? JSON.stringify(args, null, 2) : '';
    return `${timestamp} ${this.prefix} [${LogLevel[level]}] ${message} ${metadata}`.trim();
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARNING)) {
      console.warn(this.formatMessage(LogLevel.WARNING, message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, ...args));
      // Log stack trace if an error object is provided
      if (args[0] instanceof Error) {
        console.error(this.formatMessage(LogLevel.ERROR, 'Stack trace:', args[0].stack));
      }
    }
  }
}
