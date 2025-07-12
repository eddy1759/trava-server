import { z } from 'zod';
import * as dotenv from "dotenv"

dotenv.config()

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SERVICE_NAME: z.string().default('Trava'),
    PORT: z.coerce.number().default(8080),
    DATABASE_URL: z.string().url(),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    
    // Redis Configuration
    REDIS_URL: z.string().url(),
    REDIS_USERNAME: z.string(),
    REDIS_PASSWORD: z.string(),
    REDIS_PORT: z.coerce.number().min(1),
    REDIS_HOST: z.string(),
    REDIS_INITIAL_CONNECT_RETRIES: z.coerce.number().min(0),
    REDIS_INITIAL_CONNECT_RETRY_DELAY: z.coerce.number().min(0).default(200),
    REVOKED_TOKEN_REDIS_PREFIX: z.string().default('revoked_token'),
    
    // RabbitMQ Configuration
    RABBITMQ_URL: z.string().url(),
    RABBITMQ_DEFAULT_USER: z.string(),
    RABBITMQ_DEFAULT_PASS: z.string(),
    
    // JWT Configuration
    JWT_ACCESS_SECRET: z.string().min(32).max(1024),
    JWT_REFRESH_SECRET: z.string().min(32).max(1024),
    JWT_EXPIRES_IN: z.coerce.number().default(900), // 15 minutes
    JWT_REFRESH_EXPIRES_IN_SECONDS: z.coerce.number().default(604800),
    JWT_ISSUER: z.string().default('TravaIssuer'),
    JWT_AUDIENCE: z.string().default('TravaIssuer'),
    JWT_VERIFICATION_SECRET: z.string().min(32).max(1024),
    JWT_VERIFICATION_EXPIRY: z.coerce.number().default(600), // 10 minutes
    JWT_PASSWORD_RESET_SECRET: z.string().min(32).max(1024),
    JWT_PASSWORD_RESET_EXPIRY: z.coerce.number().min(1).default(300), // 5 minutes
    SALT_ROUNDS: z.coerce.number().min(10).max(12).default(10),
    REFRESH_TOKEN_REDIS_PREFIX: z.string().default('refresh_token'),
    REVOKED_ACCESS_TOKEN_REDIS_PREFIX: z.string().default('revoked_access_token'),
    REVOKED_REFRESH_TOKEN_REDIS_PREFIX: z.string().default('revoked_refresh_token'),
    REFRESH_TOKEN_EXPIRY_SECONDS: z.coerce.number().min(1).default(604800),
    
    // Email Configuration
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().min(1).default(465),
    SMTP_USER: z.string().email().default('eddy1759@gmail.com'),
    SMTP_PASS: z.string().min(8).max(100).default('fudtaenibqyzomno'),
    EMAIL_FROM: z.string().default('Trava'),
    SMTP_SECURE: z.string().default('true'),
    
    // AI Configuration
    OPENAI_API_KEY: z.string().min(32).max(1024),
    OPENAI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2),
    OPENAI_MODEL: z.string().default('gpt-3.5-turbo-instruct'),
    OPENAI_API_TIMEOUT: z.coerce.number().min(1000).default(15000),
    OPENAI_API_RETRIES: z.coerce.number().min(0).default(2),
    OPENAI_API_URL: z.string().url().default('https://api.openai.com/v1/chat/completions'),
    TOGETHER_API_KEY: z.string().min(32).max(1024),
    
    // Cloudinary Configuration
    CLOUD_NAME: z.string().default('dnfydnfpw'),
    CLOUDINARY_API_KEY: z.string().min(1).max(1024),
    CLOUDINARY_API_SECRET: z.string().min(1).max(1024),
    CLOUDINARY_URL: z.string().url().default('cloudinary://645121677278963:OB7oFxi3iCXuk95RAgpxZT4QSK8@dnfydnfpw'),
    
    // Location & Geocoding Services
    MAPBOX_API_KEY: z.string().min(1),
    MAPBOX_API_TIMEOUT: z.coerce.number().min(1000).default(10000),
    MAPBOX_API_RETRIES: z.coerce.number().min(0).default(3),
    MAPBOX_RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).default(300),
    
    // Fallback Geocoding Services
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    GOOGLE_MAPS_API_TIMEOUT: z.coerce.number().min(1000).default(10000),
    GOOGLE_MAPS_API_RETRIES: z.coerce.number().min(0).default(3),
    
    // Country Information Services
    REST_COUNTRIES_API_URL: z.string().url().default('https://restcountries.com/v3.1'),
    REST_COUNTRIES_API_TIMEOUT: z.coerce.number().min(1000).default(8000),
    REST_COUNTRIES_API_RETRIES: z.coerce.number().min(0).default(2),
    
    // Alternative Country Info Services
    COUNTRY_LAYER_API_KEY: z.string().optional(),
    COUNTRY_LAYER_API_URL: z.string().url().default('http://api.countrylayer.com/v2'),
    COUNTRY_LAYER_API_TIMEOUT: z.coerce.number().min(1000).default(8000),
    
    // Weather Services
    OPENWEATHER_API_KEY: z.string().min(1),
    OPENWEATHER_API_URL: z.string().url().default('https://api.openweathermap.org/data/2.5'),
    OPENWEATHER_API_TIMEOUT: z.coerce.number().min(1000).default(8000),
    OPENWEATHER_API_RETRIES: z.coerce.number().min(0).default(2),
    OPENWEATHER_UNITS: z.enum(['metric', 'imperial', 'kelvin']).default('metric'),
    
    // Alternative Weather Services
    WEATHERAPI_API_KEY: z.string().optional(),
    WEATHERAPI_API_URL: z.string().url().default('http://api.weatherapi.com/v1'),
    WEATHERAPI_API_TIMEOUT: z.coerce.number().min(1000).default(8000),
    
    ACCUWEATHER_API_KEY: z.string().optional(),
    ACCUWEATHER_API_URL: z.string().url().default('http://dataservice.accuweather.com'),
    ACCUWEATHER_API_TIMEOUT: z.coerce.number().min(1000).default(8000),
    
    // Points of Interest Services
    FOURSQUARE_API_KEY: z.string().optional(),
    FOURSQUARE_API_SECRET: z.string().optional(),
    FOURSQUARE_API_URL: z.string().url().default('https://api.foursquare.com/v3'),
    FOURSQUARE_API_TIMEOUT: z.coerce.number().min(1000).default(10000),
    
    GOOGLE_PLACES_API_KEY: z.string().optional(),
    GOOGLE_PLACES_API_URL: z.string().url().default('https://maps.googleapis.com/maps/api/place'),
    GOOGLE_PLACES_API_TIMEOUT: z.coerce.number().min(1000).default(10000),
    
    // AI Services
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_API_TIMEOUT: z.coerce.number().min(1000).default(15000),
    GEMINI_API_RETRIES: z.coerce.number().min(0).default(2),
    
    // File Storage
    AWS_REGION: z.string().default('us-east-1'),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    
    // Security & Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
    API_REQUEST_TIMEOUT: z.coerce.number().min(1000).default(30000),
    MAX_FILE_SIZE: z.coerce.number().min(1024).default(5242880), // 5MB
    MAX_FILES_PER_REQUEST: z.coerce.number().min(1).default(10),
    
    // Cache Configuration
    CACHE_TTL: z.coerce.number().min(60).default(3600), // 1 hour
    WEATHER_CACHE_TTL: z.coerce.number().min(300).default(1800), // 30 minutes
    LOCATION_CACHE_TTL: z.coerce.number().min(3600).default(86400), // 24 hours
    POI_CACHE_TTL: z.coerce.number().min(3600).default(86400), // 24 hours
    
    // Queue Configuration
    BULLMQ_WORKER_CONCURRENCY: z.coerce.number().min(1).default(5),
    EMAIL_WORKER_CONCURRENCY: z.coerce.number().min(1).default(5),
    QUEUE_RETRY_ATTEMPTS: z.coerce.number().min(1).default(3),
    QUEUE_RETRY_DELAY: z.coerce.number().min(1000).default(5000),
    
    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
    
    // Monitoring
    ENABLE_METRICS: z.string().transform(val => val === 'true').default('false'),
    METRICS_PORT: z.coerce.number().min(1).default(9090),
    
    // Feature Flags
    ENABLE_WEATHER_FALLBACK: z.string().transform(val => val === 'true').default('true'),
    ENABLE_POI_FALLBACK: z.string().transform(val => val === 'true').default('true'),
    ENABLE_COUNTRY_INFO_FALLBACK: z.string().transform(val => val === 'true').default('true'),
    ENABLE_CONTENT_MODERATION: z.string().transform(val => val === 'true').default('true'),
    ENABLE_AI_OPTIMIZATION: z.string().transform(val => val === 'true').default('true'),
    LOCATIONIQ_API_KEY: z.string(),
    OPENCAGE_API_KEY: z.string(),
    
    // OpenTripMap Configuration (Free POI provider)
    OPENTRIPMAP_API_TIMEOUT: z.coerce.number().min(1000).default(10000),
    OPENTRIPMAP_API_RETRIES: z.coerce.number().min(0).default(2),
    
    // Here Places Configuration (Alternative POI provider)
    HERE_API_KEY: z.string().optional(),
    HERE_API_TIMEOUT: z.coerce.number().min(1000).default(10000),
    HERE_API_RETRIES: z.coerce.number().min(0).default(2),
    
    // Country Layer API Retries
    COUNTRY_LAYER_API_RETRIES: z.coerce.number().min(0).default(2),
    
    // Stripe Configuration
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    STRIPE_PUBLISHABLE_KEY: z.string().min(1)
});

const CONFIG = envSchema.parse(process.env);

export default CONFIG;
