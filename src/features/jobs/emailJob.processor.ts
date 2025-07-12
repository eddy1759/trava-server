import { z } from 'zod';
import logger from '../../utils/logger';
import { amqpWrapper } from '../../services/amqpWrapper';
import { emailService } from '../../services/email/email.service';


const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

const BaseEmailPayloadSchema = z.object({
  to: z.string().email(),
  retryCount: z.number().int().min(0).optional(),
});

const verificationEmailPayloadSchema = BaseEmailPayloadSchema.extend({
    type: z.literal('email_verification'),
    token: z.string({ required_error: "Verification token is required" }).min(1),
    fullName: z.string().optional(),
});

const WelcomePayloadSchema = BaseEmailPayloadSchema.extend({
    type: z.literal('welcome_email'),
    fullName: z.string().optional(),
});

const PasswordResetPayloadSchema = BaseEmailPayloadSchema.extend({
    type: z.literal('password_reset'),
    token: z.string({ required_error: "Password reset token is required" }).min(1),
});

const EmailPayloadSchema = z.discriminatedUnion('type', [
    verificationEmailPayloadSchema,
    WelcomePayloadSchema,
    PasswordResetPayloadSchema,
]);

export type EmailJobPayload = z.infer<typeof EmailPayloadSchema>;

const processEmailJob = async(rawPayload: unknown): Promise<boolean> => {
    const validationResult = EmailPayloadSchema.safeParse(rawPayload);

    if (!validationResult.success) {
        logger.error('Invalid email job payload received. Discarding message.',
            { errors: validationResult.error.flatten().fieldErrors, payload: rawPayload }
        );
        throw new Error(`Invalid payload: ${validationResult.error.message}`);
    }

    const payload = validationResult.data;
    const attempt = (payload.retryCount ?? 0) + 1;
    logger.info(`Processing email job of type ${payload.type} for ${payload.to}. Attempt ${attempt}`);

    try {
        switch (payload.type) {
            case 'email_verification':
                await emailService.sendVerificationEmail(payload.to, payload.token, payload.fullName);
                break;
            case 'welcome_email':
                await emailService.sendWelcomeEmailOnboarding(payload.to, payload.fullName);
                break;
            case 'password_reset':
                await emailService.sendForgotPasswordEmail(payload.to, payload.token);
                break;
            default:
                logger.error(`Unknown email job type: ${(payload as { type?: string }).type ?? 'unknown'}. This indicates an unhandled case.`);
                throw new Error(`Unknown email type: ${(payload as any).type}`);
        }
        logger.info(`Email job for ${payload.to} processed successfully.`);
        return true; // Job processed successfully
    } catch (error) {
        logger.error(`Failed to send email for ${payload.to} (Type: ${payload.type}, Attempt: ${attempt}):`, error);

        if (attempt >= MAX_RETRIES) {
            logger.error(`Maximum retries reached for email job ${payload.type} to ${payload.to}. Moving to DLQ.`);
            throw error; // Rethrow to signal processing failure to MQ consumer
        } else {
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1); 
            logger.warn(`Retrying email job ${payload.type} to ${payload.to} in ${delay}ms (Attempt: ${attempt + 1}).`);

            // Modify payload for retry
            const retryPayload = { ...payload, retryCount: attempt };
            await amqpWrapper.sendEmailQueue(retryPayload);
            throw error; // Rethrow to signal processing failure to MQ consumer
        }
    }
}

export const startEmailJobProcessor = async (): Promise<void> => { // Renamed for clarity
    try {
        logger.info('Attempting to start Email Job Processor worker...');

        const queueName = 'email_job_queue';
        const deadLetterExchange = 'email_job_dlx';
        const deadLetterQueueName = 'email_job_dlx_queue';

        await amqpWrapper.setupQueueWithDLX({
            queueName: queueName,
            options: { 
                durable: true, 
                'x-dead-letter-exchange': deadLetterExchange, 
                'x-dead-letter-routing-key': 'email_job_retry' 
            }, // Standard options for main queue
            deadLetterExchange: deadLetterExchange,
            deadLetterQueueName: deadLetterQueueName,
            deadLetterRoutingKey: queueName, 
        });

        logger.info(`Queue [${queueName}] and DLX [${deadLetterExchange}] setup verified.`);

        const concurrency = parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '5', 10); // Tune this value based on deployment environment
        logger.info(`Starting consumer for ${queueName} with concurrency ${concurrency}`);

        await amqpWrapper.consumeMessages<unknown>( 
            queueName,
            processEmailJob, 
            {}, 
            concurrency
        );

        logger.info(`[*] Email Job Processor worker started successfully. Waiting for messages in '${queueName}'.`);

    } catch (error: any) {
        logger.error('Failed to start or run Email Job Processor worker.', {
             errorMessage: error instanceof Error ? error.message : String(error),
             errorDetails: error // Log the full error object for details
         });
        process.exit(1);
    }
};
