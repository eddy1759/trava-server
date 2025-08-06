# Trava - Travel SaaS Platform

A comprehensive travel planning and management platform with premium features, real-time collaboration, and AI-powered recommendations.

## 🚀 Features

- **Trip Management**: Create, plan, and track trips with collaborative features
- **Journal Entries**: Rich text journaling with photo support and semantic search
- **Photo Sharing**: Upload, organize, and share travel photos with social features
- **AI-Powered Recommendations**: RAG-based travel suggestions and cost optimization
- **Real-time Weather**: Location-based weather data with caching
- **Expense Tracking**: Comprehensive expense management with categorization
- **Packing Lists**: Collaborative packing list management
- **Gamification**: Badge system for user engagement
- **Content Moderation**: Automated content filtering and approval
- **Queue System**: Robust background processing with BullMQ and RabbitMQ

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Workers       │
│   (React/Vue)   │◄──►│   (Express)     │◄──►│   (BullMQ)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   Redis         │
                       │   (Prisma)      │    │   (Cache/Queue) │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   AWS S3        │    │   RabbitMQ      │
                       │   Cloudinary    │    │   (Email Queue) │
                       └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: BullMQ (Redis) + RabbitMQ
- **File Storage**: AWS S3 + Cloudinary
- **AI/ML**: Google Gemini API with RAG
- **Caching**: Redis
- **Authentication**: JWT
- **Validation**: Zod
- **Testing**: Jest, Supertest

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- RabbitMQ 3.8+
- Docker (optional)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/eddy1759/trava-server.git
cd trava-server
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/trava"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# External APIs
MAPBOX_API_KEY="your-mapbox-key"
OPENWEATHER_API_KEY="your-openweather-key"
GEMINI_API_KEY="your-gemini-key"

# File Storage
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email"
SMTP_PASS="your-password"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"
```

### 4. Database Setup
```bash
# Run migrations
npx prisma migrate dev

# Seed database
pnpm run seed
```

### 5. Start Services

#### Development Mode
```bash
# Start API server
pnpm run dev

# Start workers (in separate terminal)
pnpm run workers

# Start email processor (in separate terminal)
pnpm run email-worker
```

#### Production Mode
```bash
# Build the project
npm run build

# Start all services
npm start
```

### 6. Verify Installation
```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api-docs
```

## 📁 Project Structure

```
trava-server/
├── src/
│   ├── features/           # Feature modules
│   │   ├── auth/          # Authentication
│   │   ├── trip/          # Trip management
│   │   ├── journalEntry/  # Journal entries
│   │   ├── photo/         # Photo management
│   │   ├── expense/       # Expense tracking
│   │   ├── packingList/   # Packing lists
│   │   ├── gamification/  # Badges and achievements
│   │   └── jobs/          # Queue workers
│   ├── services/          # Business logic services
│   ├── middlewares/       # Express middlewares
│   ├── utils/             # Utility functions
│   └── config/            # Configuration files
├── prisma/                # Database schema and migrations
├── public/                # Static assets
└── tests/                 # Test files
```

## 🔧 Configuration

### Environment Variables

#### Required
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `MAPBOX_API_KEY`: Mapbox API key for location services
- `GEMINI_API_KEY`: Google Gemini API key for AI features

#### Optional
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)

### Queue Configuration
```bash
# Worker concurrency
BULLMQ_WORKER_CONCURRENCY=5
EMAIL_WORKER_CONCURRENCY=5

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
pnpm test

# Integration tests
pnpm run test:integration

# E2E tests
pnpm run test:e2e

# Coverage report
pnpm run test:coverage
```

### Test Database
```bash
# Setup test database
pnpm run test:setup

# Clean test database
pnpm run test:clean
```

## 📊 Monitoring

### Health Checks
- `GET /health`: Basic health check
- `GET /health/detailed`: Detailed system status
- `GET /health/queues`: Queue metrics

### Logging
```bash
# View logs
pnpm run logs

# View worker logs
pnpm run logs:workers
```

### Metrics
- Queue job counts and processing times
- API response times and error rates
- Database query performance
- Cache hit/miss ratios

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t trava-api .

# Run container
docker run -p 3000:3000 trava-api
```

### Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx)
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

### Code Style
```bash
# Format code
pnpm run format

# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint:fix
```

### Commit Convention
```
feat: add new feature
fix: bug fix
docs: documentation update
style: code formatting
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

## 📚 API Documentation

- [Complete API Documentation](documentation.md)
- [Testing Guide](steps.md)
- [Frontend Integration Guide](FRONTEND_INTEGRATION.md)

## 🔗 External Services

### Required APIs
- **Mapbox**: Location services and POI data
- **OpenWeatherMap**: Weather data
- **Google Gemini**: AI recommendations and RAG

### Optional Services
- **AWS S3**: File storage
- **Cloudinary**: Image optimization
- **SendGrid**: Email delivery

## 🐛 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check database status
npx prisma db push

# Reset database
npx prisma migrate reset
```

#### Redis Connection
```bash
# Test Redis connection
redis-cli ping

# Clear Redis cache
redis-cli FLUSHALL
```

#### Queue Issues
```bash
# Check queue status
pnpm run queues:status

# Clear failed jobs
pnpm run queues:clean
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Debug specific modules
DEBUG=trava:* npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Prisma](https://prisma.io/) for database ORM
- [BullMQ](https://docs.bullmq.io/) for queue management
- [Express](https://expressjs.com/) for web framework
- [Zod](https://zod.dev/) for validation

## 📞 Support

- **Documentation**: [docs.trava.com](https://docs.trava.com)
- **Issues**: [GitHub Issues](https://github.com/your-username/trava-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/trava-server/discussions)
- **Email**: support@trava.com
