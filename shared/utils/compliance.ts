import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Define schemas for compliance checking
const projectStructureSchema = z.object({
  client: z.boolean(),
  server: z.boolean(),
  shared: z.boolean(),
  docs: z.boolean(),
  'drizzle.config.ts': z.boolean(),
});

export class ComplianceChecker {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  // Check project structure
  async checkProjectStructure(): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];
    const structure: Record<string, boolean> = {
      client: false,
      server: false,
      shared: false,
      docs: false,
      'drizzle.config.ts': false,
    };

    try {
      const files = fs.readdirSync(this.basePath);
      for (const key of Object.keys(structure)) {
        structure[key] = files.includes(key);
        if (!structure[key]) {
          issues.push(`Missing required directory/file: ${key}`);
        }
      }

      // Validate using zod schema
      const result = projectStructureSchema.safeParse(structure);
      return {
        passed: result.success,
        issues,
      };
    } catch (error) {
      return {
        passed: false,
        issues: [`Error checking project structure: ${error}`],
      };
    }
  }

  // Check for required documentation
  async checkDocumentation(): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];
    const requiredDocs = ['BEST_PRACTICES.md', 'API.md', 'SCHEMA.md'];

    try {
      const docsPath = path.join(this.basePath, 'docs');
      const docs = fs.existsSync(docsPath) ? fs.readdirSync(docsPath) : [];

      for (const doc of requiredDocs) {
        if (!docs.includes(doc)) {
          issues.push(`Missing required documentation: ${doc}`);
        }
      }

      return {
        passed: issues.length === 0,
        issues,
      };
    } catch (error) {
      return {
        passed: false,
        issues: [`Error checking documentation: ${error}`],
      };
    }
  }

  // Check for security best practices
  async checkSecurityPractices(): Promise<{ passed: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for environment variables usage
      const envPath = path.join(this.basePath, '.env');
      if (fs.existsSync(envPath)) {
        issues.push('Detected .env file in repository. Use Replit Secrets instead.');
      }

      // Check server configuration
      const authPath = path.join(this.basePath, 'server', 'auth.ts');
      const indexPath = path.join(this.basePath, 'server', 'index.ts');

      if (!fs.existsSync(authPath) || !fs.existsSync(indexPath)) {
        issues.push('Missing server authentication configuration files');
        return { passed: false, issues };
      }

      const authContent = fs.readFileSync(authPath, 'utf-8');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');

      // Check for session middleware setup in auth.ts
      if (!authContent.includes('express-session')) {
        issues.push('Missing session middleware import in auth configuration');
      }

      // Check for auth setup in index.ts
      if (!indexContent.includes('setupAuth(app)')) {
        issues.push('Missing auth setup in server configuration');
      }

      return {
        passed: issues.length === 0,
        issues,
      };
    } catch (error) {
      return {
        passed: false,
        issues: [`Error checking security practices: ${error}`],
      };
    }
  }

  // Run all compliance checks
  async runAllChecks(): Promise<{
    passed: boolean;
    results: Record<string, { passed: boolean; issues: string[] }>;
  }> {
    const results = {
      projectStructure: await this.checkProjectStructure(),
      documentation: await this.checkDocumentation(),
      security: await this.checkSecurityPractices(),
    };

    const passed = Object.values(results).every((result) => result.passed);

    return {
      passed,
      results,
    };
  }
}