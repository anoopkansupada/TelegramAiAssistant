import { CustomLogger } from "./logger";

const logger = new CustomLogger("[ErrorHandler]");

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

export enum ErrorType {
  // Authentication Errors (400-403)
  INVALID_CREDENTIALS = 'https://api.errors.com/auth/invalid-credentials',
  INVALID_PHONE = 'https://api.errors.com/auth/invalid-phone',
  INVALID_CODE = 'https://api.errors.com/auth/invalid-code',
  EXPIRED_CODE = 'https://api.errors.com/auth/expired-code',
  INVALID_2FA = 'https://api.errors.com/auth/invalid-2fa',
  
  // Rate Limiting (429)
  RATE_LIMIT = 'https://api.errors.com/rate-limit',
  
  // Server Errors (500-503)
  SERVER_ERROR = 'https://api.errors.com/server-error',
  SERVICE_UNAVAILABLE = 'https://api.errors.com/service-unavailable',
  EXTERNAL_SERVICE_ERROR = 'https://api.errors.com/external-service-error',
  
  // Validation Errors (400)
  VALIDATION_ERROR = 'https://api.errors.com/validation-error',
  
  // Resource Errors (404, 409)
  NOT_FOUND = 'https://api.errors.com/not-found',
  CONFLICT = 'https://api.errors.com/conflict'
}

export class APIError extends Error {
  constructor(
    public type: ErrorType,
    public title: string,
    public status: number,
    public detail: string,
    public instance?: string,
    public errors?: Record<string, string[]>
  ) {
    super(detail);
    this.name = 'APIError';
  }

  toProblemDetails(): ProblemDetails {
    const problem: ProblemDetails = {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail
    };

    if (this.instance) {
      problem.instance = this.instance;
    }

    if (this.errors) {
      problem.errors = this.errors;
    }

    return problem;
  }

  static fromTelegramError(error: any): APIError {
    logger.error('Telegram error:', error);

    if (error.message?.includes('PHONE_NUMBER_INVALID')) {
      return new APIError(
        ErrorType.INVALID_PHONE,
        'Invalid Phone Number',
        400,
        'The provided phone number format is invalid.'
      );
    }

    if (error.message?.includes('PHONE_CODE_INVALID')) {
      return new APIError(
        ErrorType.INVALID_CODE,
        'Invalid Verification Code',
        400,
        'The provided verification code is incorrect.'
      );
    }

    if (error.message?.includes('PHONE_CODE_EXPIRED')) {
      return new APIError(
        ErrorType.EXPIRED_CODE,
        'Expired Verification Code',
        400,
        'The verification code has expired. Please request a new one.'
      );
    }

    if (error.message?.includes('SESSION_PASSWORD_NEEDED')) {
      return new APIError(
        ErrorType.INVALID_2FA,
        '2FA Required',
        401,
        'Two-factor authentication is required to complete this action.'
      );
    }

    if (error.message?.includes('FLOOD_WAIT')) {
      return new APIError(
        ErrorType.RATE_LIMIT,
        'Rate Limit Exceeded',
        429,
        'Too many attempts. Please try again later.'
      );
    }

    // Default to service unavailable for unknown errors
    return new APIError(
      ErrorType.SERVICE_UNAVAILABLE,
      'Service Unavailable',
      503,
      'The service is temporarily unavailable. Please try again later.'
    );
  }
}

export function errorHandler(error: unknown): ProblemDetails {
  if (error instanceof APIError) {
    return error.toProblemDetails();
  }

  // Handle unexpected errors
  logger.error('Unexpected error:', error);
  return new APIError(
    ErrorType.SERVER_ERROR,
    'Internal Server Error',
    500,
    'An unexpected error occurred.'
  ).toProblemDetails();
}
