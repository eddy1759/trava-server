import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodIssue } from 'zod';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError'; // Adjust path if needed

interface ValidationSchema {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
  headers?: AnyZodObject;
  cookies?: AnyZodObject;
}

/**
 * Configuration options to customize the behavior of the validation middleware.
 */
interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  maxIssues?: number;
}

/**
 * Defines the structured format for a single validation error.
 * This is sent to the client for clear, field-specific feedback.
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}


export const validate = (
  schema: ValidationSchema,
  options: ValidationOptions = {}
) => {
  const { abortEarly = false, maxIssues = 10 } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Use a map to iterate over the parts to be validated
      const partsToValidate: [keyof ValidationSchema, keyof Request][] = [
        ['body', 'body'],
        ['query', 'query'],
        ['params', 'params'],
        ['headers', 'headers'],
        ['cookies', 'cookies'],
      ];

      const allIssues: ZodIssue[] = [];

      // Validate each part of the request defined in the schema
      for (const [schemaKey, reqKey] of partsToValidate) {
        const partSchema = schema[schemaKey];
        if (partSchema) {
          const dataToValidate = req[reqKey];

          // Using `safeParseAsync` to handle errors without throwing immediately
          const result = await partSchema.safeParseAsync(dataToValidate);

          if (!result.success) {
            // Add context to each issue by prepending the request part (e.g., 'body.')
            const contextualIssues = result.error.issues.map(issue => ({
              ...issue,
              path: [schemaKey, ...issue.path],
            }));
            allIssues.push(...contextualIssues);
          } else if (reqKey === 'query') {
            // For query, we need to use Object.defineProperty or modify the object properties
            Object.keys(req.query).forEach(key => {
              delete (req.query as any)[key];
            });
            Object.assign(req.query, result.data);
          } else {
            (req as any)[reqKey] = result.data;
          }
        }
      }

      // If there are any issues after checking all parts, format and throw the error
      if (allIssues.length > 0) {
        throw new ZodError(allIssues);
      }

      // If all validations pass, proceed to the next middleware
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Limit the number of issues reported to avoid flooding the client
        const limitedIssues = error.issues.slice(0, maxIssues);

        // Format validation errors into a structured, client-friendly format
        const validationErrors: ValidationErrorDetail[] = limitedIssues.map(
          (issue: ZodIssue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
            received: 'received' in issue ? (issue as any).received : undefined,
            expected: getExpectedTypeFromIssue(issue),
          })
        );

       
        return next(new ApiError(`The request data is invalid. ${JSON.stringify(validationErrors)}`, StatusCodes.BAD_REQUEST));
      }

      // Handle unexpected errors during the validation process
      console.error('Unexpected error during request validation:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      const systemError = new ApiError(
        'An internal error occurred during request validation.',
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
      return next(systemError);
    }
  };
};
// #endregion

// #region: Helper and Convenience Functions

/**
 * A helper function to extract a human-readable "expected type" from a Zod issue.
 * @param issue - The ZodIssue object.
 * @returns A string describing the expected data type or format.
 */
function getExpectedTypeFromIssue(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.expected;
    case 'invalid_string':
      return `a valid string matching ${issue.validation}`;
    case 'too_small':
      return `at least ${issue.minimum} characters or items`;
    case 'too_big':
      return `at most ${issue.maximum} characters or items`;
    case 'invalid_enum_value':
      return `one of: ${issue.options.join(', ')}`;
    case 'invalid_date':
      return 'a valid date';
    case 'invalid_union':
        return 'a value matching one of the available types';
    case 'custom':
      return issue.params?.expected || 'a valid value';
    default:
      return 'a valid value';
  }
}

/**
 * Convenience factory for validating only the request body.
 * @param schema - A Zod schema to validate `req.body`.
 * @param options - Optional validation configuration.
 */
export const validateBody = (schema: AnyZodObject, options?: ValidationOptions) =>
  validate({ body: schema }, options);

/**
 * Convenience factory for validating only the request query parameters.
 * @param schema - A Zod schema to validate `req.query`.
 * @param options - Optional validation configuration.
 */
export const validateQuery = (schema: AnyZodObject, options?: ValidationOptions) =>
  validate({ query: schema }, options);

/**
 * Convenience factory for validating only the request URL parameters.
 * @param schema - A Zod schema to validate `req.params`.
 * @param options - Optional validation configuration.
 */
export const validateParams = (schema: AnyZodObject, options?: ValidationOptions) =>
  validate({ params: schema }, options);

/**
 * A higher-order function to chain multiple validation middlewares sequentially.
 * This is useful for composing validations from different modules.
 *
 * @param validators - An array of Express middleware functions to run in sequence.
 * @returns A single Express middleware function.
 */
export const combineValidators = (...validators: ReturnType<typeof validate>[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // A function to run the validators in sequence
    const run = (index: number) => {
        if (index >= validators.length) {
            // All validators have passed
            return next();
        }
        // Get the current validator and run it.
        // The third argument is a callback that will be `next` in the validator.
        // If it's called without an error, we run the next validator in the chain.
        // If it's called with an error, we pass it to the main error handler.
        validators[index](req, res, (error?: any) => {
            if (error) {
                return next(error);
            }
            run(index + 1);
        });
    };
    run(0);
  };
};
// #endregion
