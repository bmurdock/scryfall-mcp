/**
 * Utility functions for safely parsing environment variables
 */

/**
 * Safely parses an integer from an environment variable
 */
export function parseEnvInt(envVar: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (!envVar || envVar.trim() === '') {
    return defaultValue;
  }

  const parsed = parseInt(envVar.trim(), 10);
  
  if (isNaN(parsed)) {
    console.warn(`Invalid integer value for environment variable: "${envVar}". Using default: ${defaultValue}`);
    return defaultValue;
  }

  if (min !== undefined && parsed < min) {
    console.warn(`Environment variable value ${parsed} is below minimum ${min}. Using minimum value.`);
    return min;
  }

  if (max !== undefined && parsed > max) {
    console.warn(`Environment variable value ${parsed} is above maximum ${max}. Using maximum value.`);
    return max;
  }

  return parsed;
}

/**
 * Safely parses a float from an environment variable
 */
export function parseEnvFloat(envVar: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (!envVar || envVar.trim() === '') {
    return defaultValue;
  }

  const parsed = parseFloat(envVar.trim());
  
  if (isNaN(parsed)) {
    console.warn(`Invalid float value for environment variable: "${envVar}". Using default: ${defaultValue}`);
    return defaultValue;
  }

  if (min !== undefined && parsed < min) {
    console.warn(`Environment variable value ${parsed} is below minimum ${min}. Using minimum value.`);
    return min;
  }

  if (max !== undefined && parsed > max) {
    console.warn(`Environment variable value ${parsed} is above maximum ${max}. Using maximum value.`);
    return max;
  }

  return parsed;
}

/**
 * Safely parses a boolean from an environment variable
 */
export function parseEnvBoolean(envVar: string | undefined, defaultValue: boolean): boolean {
  if (!envVar || envVar.trim() === '') {
    return defaultValue;
  }

  const trimmed = envVar.trim().toLowerCase();
  
  if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes' || trimmed === 'on') {
    return true;
  }
  
  if (trimmed === 'false' || trimmed === '0' || trimmed === 'no' || trimmed === 'off') {
    return false;
  }

  console.warn(`Invalid boolean value for environment variable: "${envVar}". Using default: ${defaultValue}`);
  return defaultValue;
}

/**
 * Safely parses a string from an environment variable with validation
 */
export function parseEnvString(
  envVar: string | undefined, 
  defaultValue: string, 
  allowedValues?: string[],
  minLength?: number,
  maxLength?: number
): string {
  if (!envVar || envVar.trim() === '') {
    return defaultValue;
  }

  const trimmed = envVar.trim();

  if (minLength !== undefined && trimmed.length < minLength) {
    console.warn(`Environment variable value "${trimmed}" is too short (min ${minLength}). Using default.`);
    return defaultValue;
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    console.warn(`Environment variable value "${trimmed}" is too long (max ${maxLength}). Using default.`);
    return defaultValue;
  }

  if (allowedValues && !allowedValues.includes(trimmed)) {
    console.warn(`Environment variable value "${trimmed}" is not in allowed values: ${allowedValues.join(', ')}. Using default.`);
    return defaultValue;
  }

  return trimmed;
}

/**
 * Configuration validation helpers
 */
export const EnvValidators = {
  /**
   * Rate limiter configuration
   */
  rateLimitMs: (value?: string) => parseEnvInt(value, 100, 50, 5000),
  rateLimitQueueMax: (value?: string) => parseEnvInt(value, 500, 10, 50000),
  
  /**
   * Cache configuration
   */
  cacheMaxSize: (value?: string) => parseEnvInt(value, 10000, 100, 1000000),
  cacheMaxMemoryMB: (value?: string) => parseEnvInt(value, 100, 10, 10000),
  
  /**
   * Timeout configuration
   */
  scryfallTimeoutMs: (value?: string) => parseEnvInt(value, 15000, 1000, 300000),
  
  /**
   * Log level configuration
   */
  logLevel: (value?: string) => parseEnvString(
    value, 
    'info', 
    ['error', 'warn', 'info', 'debug', 'trace']
  ),
  
  /**
   * Node environment
   */
  nodeEnv: (value?: string) => parseEnvString(
    value,
    'development',
    ['development', 'production', 'test']
  ),
  
  /**
   * Health check configuration
   */
  healthCheckDeep: (value?: string) => parseEnvBoolean(value, false),
  
  /**
   * User agent validation
   */
  userAgent: (value?: string) => parseEnvString(
    value,
    'ScryfallMCPServer/1.0.2',
    undefined,
    5,
    200
  )
};