import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import CONFIG from '../config/env';
import { cache } from './cache.service';

interface WeatherData {
    main: string;
    description: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: number;
    visibility: number;
    iconUrl: string;
    source: string;
    timestamp: Date;
}

interface WeatherProvider {
    name: string;
    enabled: boolean;
    apiKey?: string;
    timeout: number;
    retries: number;
    rateLimit: number;
}

// Enhanced HTTP client with retry logic and rate limiting
class WeatherClient {
    private client: AxiosInstance;
    private provider: WeatherProvider;
    private requestCount = 0;
    private lastResetTime = Date.now();

    constructor(provider: WeatherProvider) {
        this.provider = provider;
        this.client = axios.create({
            timeout: provider.timeout,
        });
    }

    private async checkRateLimit(): Promise<void> {
        const now = Date.now();
        const windowMs = 60000; // 1 minute

        if (now - this.lastResetTime > windowMs) {
            this.requestCount = 0;
            this.lastResetTime = now;
        }

        if (this.requestCount >= this.provider.rateLimit) {
            const waitTime = windowMs - (now - this.lastResetTime);
            logger.warn(`Rate limit exceeded for ${this.provider.name}. Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.lastResetTime = Date.now();
        }
    }

    async get(url: string, params?: any): Promise<any> {
        await this.checkRateLimit();
        this.requestCount++;

        for (let attempt = 0; attempt <= this.provider.retries; attempt++) {
            try {
                const response = await this.client.get(url, { params });
                return response.data;
            } catch (error: any) {
                if (attempt === this.provider.retries) {
                    throw error;
                }
                
                const delay = Math.pow(2, attempt) * 1000;
                logger.warn(`Attempt ${attempt + 1} failed for ${this.provider.name}, retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

// OpenWeatherMap provider
async function getWeatherFromOpenWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const provider: WeatherProvider = {
        name: 'OpenWeatherMap',
        enabled: !!CONFIG.OPENWEATHER_API_KEY,
        apiKey: CONFIG.OPENWEATHER_API_KEY,
        timeout: CONFIG.OPENWEATHER_API_TIMEOUT,
        retries: CONFIG.OPENWEATHER_API_RETRIES,
        rateLimit: 60, // OpenWeatherMap free tier limit
    };

    if (!provider.enabled) {
        throw new Error('OpenWeatherMap API key is not configured');
    }

    const client = new WeatherClient(provider);
    const endpoint = `${CONFIG.OPENWEATHER_API_URL}/weather`;

    try {
        const response = await client.get(endpoint, {
            lat,
            lon,
            appid: provider.apiKey,
            units: CONFIG.OPENWEATHER_UNITS,
        });

        return {
            main: response.weather[0].main,
            description: response.weather[0].description,
            temperature: response.main.temp,
            feelsLike: response.main.feels_like,
            humidity: response.main.humidity,
            pressure: response.main.pressure,
            windSpeed: response.wind?.speed || 0,
            windDirection: response.wind?.deg || 0,
            visibility: response.visibility || 10000,
            iconUrl: `https://openweathermap.org/img/wn/${response.weather[0].icon}@2x.png`,
            source: 'openweathermap',
            timestamp: new Date(),
        };
    } catch (error: any) {
        logger.error('OpenWeatherMap API error:', error);
        throw error;
    }
}

// WeatherAPI.com provider (fallback)
async function getWeatherFromWeatherAPI(lat: number, lon: number): Promise<WeatherData | null> {
    const provider: WeatherProvider = {
        name: 'WeatherAPI',
        enabled: !!CONFIG.WEATHERAPI_API_KEY,
        apiKey: CONFIG.WEATHERAPI_API_KEY,
        timeout: CONFIG.WEATHERAPI_API_TIMEOUT,
        retries: 2,
        rateLimit: 30, // WeatherAPI free tier limit
    };

    if (!provider.enabled) {
        throw new Error('WeatherAPI API key is not configured');
    }

    const client = new WeatherClient(provider);
    const endpoint = `${CONFIG.WEATHERAPI_API_URL}/current.json`;

    try {
        const response = await client.get(endpoint, {
            key: provider.apiKey,
            q: `${lat},${lon}`,
        });

        return {
            main: response.current.condition.text,
            description: response.current.condition.text,
            temperature: response.current.temp_c,
            feelsLike: response.current.feelslike_c,
            humidity: response.current.humidity,
            pressure: response.current.pressure_mb,
            windSpeed: response.current.wind_kph,
            windDirection: response.current.wind_degree,
            visibility: response.current.vis_km * 1000,
            iconUrl: `https:${response.current.condition.icon}`,
            source: 'weatherapi',
            timestamp: new Date(),
        };
    } catch (error: any) {
        logger.error('WeatherAPI error:', error);
        throw error;
    }
}

// AccuWeather provider (additional fallback)
async function getWeatherFromAccuWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const provider: WeatherProvider = {
        name: 'AccuWeather',
        enabled: !!CONFIG.ACCUWEATHER_API_KEY,
        apiKey: CONFIG.ACCUWEATHER_API_KEY,
        timeout: CONFIG.ACCUWEATHER_API_TIMEOUT,
        retries: 2,
        rateLimit: 50, // AccuWeather free tier limit
    };

    if (!provider.enabled) {
        throw new Error('AccuWeather API key is not configured');
    }

    const client = new WeatherClient(provider);
    
    try {
        // First, get location key
        const locationEndpoint = `${CONFIG.ACCUWEATHER_API_URL}/locations/v1/cities/geoposition/search`;
        const locationResponse = await client.get(locationEndpoint, {
            apikey: provider.apiKey,
            q: `${lat},${lon}`,
        });

        const locationKey = locationResponse.Key;

        // Then get current conditions
        const weatherEndpoint = `${CONFIG.ACCUWEATHER_API_URL}/currentconditions/v1/${locationKey}`;
        const weatherResponse = await client.get(weatherEndpoint, {
            apikey: provider.apiKey,
            details: true,
        });

        const current = weatherResponse[0];

        return {
            main: current.WeatherText,
            description: current.WeatherText,
            temperature: current.Temperature.Metric.Value,
            feelsLike: current.RealFeelTemperature.Metric.Value,
            humidity: current.RelativeHumidity,
            pressure: current.Pressure.Metric.Value,
            windSpeed: current.Wind.Speed.Metric.Value,
            windDirection: current.Wind.Direction.Degrees,
            visibility: current.Visibility.Metric.Value * 1000,
            iconUrl: `https://developer.accuweather.com/sites/default/files/${current.WeatherIcon.toString().padStart(2, '0')}-s.png`,
            source: 'accuweather',
            timestamp: new Date(),
        };
    } catch (error: any) {
        logger.error('AccuWeather error:', error);
        throw error;
    }
}

// Main weather fetching function with multiple providers and fallbacks
export async function getWeatherForLocation(lat: number, lon: number): Promise<WeatherData | null> {
    const cacheKey = `weather:${lat.toFixed(4)}:${lon.toFixed(4)}`;
    
    // Check cache first
    const cachedWeather = await cache.get<WeatherData>(cacheKey, 'weather');
    if (cachedWeather) {
        const cacheAge = Date.now() - cachedWeather.timestamp.getTime();
        const maxAge = CONFIG.WEATHER_CACHE_TTL * 1000;
        
        if (cacheAge < maxAge) {
            logger.info(`Weather cache hit for location: ${lat}, ${lon}`);
            return cachedWeather;
        }
    }

    let weatherData: WeatherData | null = null;
    let error: Error | null = null;

    // Try OpenWeatherMap first
    try {
        weatherData = await getWeatherFromOpenWeather(lat, lon);
        logger.info(`Successfully fetched weather from OpenWeatherMap for location: ${lat}, ${lon}`);
    } catch (openWeatherError) {
        error = openWeatherError as Error;
        logger.warn(`OpenWeatherMap failed for location ${lat}, ${lon}:`, openWeatherError);
    }

    // Try fallback providers if enabled and primary failed
    if (!weatherData && CONFIG.ENABLE_WEATHER_FALLBACK) {
        // Try WeatherAPI
        try {
            weatherData = await getWeatherFromWeatherAPI(lat, lon);
            logger.info(`Successfully fetched weather from WeatherAPI (fallback) for location: ${lat}, ${lon}`);
        } catch (weatherAPIError) {
            logger.warn(`WeatherAPI fallback failed for location ${lat}, ${lon}:`, weatherAPIError);
            
            // Try AccuWeather as final fallback
            try {
                weatherData = await getWeatherFromAccuWeather(lat, lon);
                logger.info(`Successfully fetched weather from AccuWeather (final fallback) for location: ${lat}, ${lon}`);
            } catch (accuWeatherError) {
                logger.error(`All weather providers failed for location ${lat}, ${lon}:`, {
                    openWeatherError: error,
                    weatherAPIError,
                    accuWeatherError
                });
            }
        }
    }

    if (!weatherData) {
        logger.error(`Failed to fetch weather data for location: ${lat}, ${lon}. All providers unavailable.`);
        return null;
    }

    // Cache the result
    await cache.set(cacheKey, weatherData, {
        ttl: CONFIG.WEATHER_CACHE_TTL,
        prefix: 'weather',
        tags: [`lat:${lat.toFixed(2)}`, `lng:${lon.toFixed(2)}`]
    });

    return weatherData;
}

// Batch weather fetching for multiple locations
export async function getWeatherForMultipleLocations(locations: Array<{lat: number, lon: number}>): Promise<Map<string, WeatherData | null>> {
    const results = new Map<string, WeatherData | null>();
    
    // Process locations in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (location) => {
            const key = `${location.lat.toFixed(4)}:${location.lon.toFixed(4)}`;
            try {
                const weather = await getWeatherForLocation(location.lat, location.lon);
                return { key, weather };
            } catch (error) {
                logger.error(`Failed to fetch weather for location ${key}:`, error);
                return { key, weather: null };
            }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result) => {
            if (result.status === 'fulfilled') {
                results.set(result.value.key, result.value.weather);
            }
        });

        // Small delay between batches to be respectful to APIs
        if (i + batchSize < locations.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}

// Weather forecast for upcoming days
export async function getWeatherForecast(lat: number, lon: number, days: number = 5): Promise<WeatherData[] | null> {
    if (!CONFIG.OPENWEATHER_API_KEY) {
        return null;
    }

    const cacheKey = `forecast:${lat.toFixed(4)}:${lon.toFixed(4)}:${days}`;
    
    // Check cache
    const cachedForecast = await cache.get<WeatherData[]>(cacheKey, 'weather');
    if (cachedForecast) {
        return cachedForecast;
    }

    const client = new WeatherClient({
        name: 'OpenWeatherMap',
        enabled: true,
        apiKey: CONFIG.OPENWEATHER_API_KEY,
        timeout: CONFIG.OPENWEATHER_API_TIMEOUT,
        retries: CONFIG.OPENWEATHER_API_RETRIES,
        rateLimit: 60,
    });

    try {
        const endpoint = `${CONFIG.OPENWEATHER_API_URL}/forecast`;
        const response = await client.get(endpoint, {
            lat,
            lon,
            appid: CONFIG.OPENWEATHER_API_KEY,
            units: CONFIG.OPENWEATHER_UNITS,
            cnt: days * 8, // 8 forecasts per day (3-hour intervals)
        });

        const forecast: WeatherData[] = response.list
            .filter((item: any, index: number) => index % 8 === 0) // Daily forecasts
            .slice(0, days)
            .map((item: any) => ({
                main: item.weather[0].main,
                description: item.weather[0].description,
                temperature: item.main.temp,
                feelsLike: item.main.feels_like,
                humidity: item.main.humidity,
                pressure: item.main.pressure,
                windSpeed: item.wind?.speed || 0,
                windDirection: item.wind?.deg || 0,
                visibility: item.visibility || 10000,
                iconUrl: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`,
                source: 'openweathermap',
                timestamp: new Date(item.dt * 1000),
            }));

        // Cache forecast
        await cache.set(cacheKey, forecast, {
            ttl: CONFIG.WEATHER_CACHE_TTL,
            prefix: 'weather',
            tags: [`lat:${lat.toFixed(2)}`, `lng:${lon.toFixed(2)}`, 'forecast']
        });

        return forecast;
    } catch (error) {
        logger.error('Failed to fetch weather forecast:', error);
        return null;
    }
}