# TixChat Backend

Realtime chat application backend built with Node.js, Express, Socket.IO, and AWS DynamoDB.

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: AWS DynamoDB
- **File Storage**: AWS S3
- **Email**: AWS SES
- **Container**: Docker

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional)
- AWS account with DynamoDB, S3, SES configured

### Local Development

```bash
npm install
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values.

### Docker

```bash
# Build image
docker build -t tixchat-backend .

# Run with docker-compose
docker-compose up -d
```

## Deployment

The backend is deployed to AWS EC2 via Docker containers. CI/CD pipeline is handled by GitHub Actions.

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key |
| `EC2_HOST` | EC2 instance hostname/IP |
| `EC2_SSH_KEY` | SSH private key |
| `EC2_USERNAME` | SSH username (default: ubuntu) |
| `EC2_SSH_PORT` | SSH port (default: 22) |
| `CLIENT_URL` | Frontend URL for CORS |
| `JWT_SECRET` | JWT signing secret |
| `JWT_REFRESH_SECRET` | JWT refresh signing secret |
| `AWS_SES_SENDER_EMAIL` | SES sender email |
| `FRONTEND_URLS` | Comma-separated list of allowed frontend URLs |
| `REDIS_URL` | Redis connection URL |

### GitHub Variables Required

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region |
| `DYNAMODB_USERS_TABLE` | DynamoDB Users table name |
| `DYNAMODB_CONVERSATIONS_TABLE` | DynamoDB Conversations table name |
| `DYNAMODB_MESSAGES_TABLE` | DynamoDB Messages table name |
| `DYNAMODB_PARTICIPANTS_TABLE` | DynamoDB Participants table name |
| `AWS_SES_REGION` | AWS SES region |
| `AWS_S3_REGION` | AWS S3 region |
| `S3_BUCKET_NAME` | S3 bucket name |
| `S3_AVATAR_FOLDER` | S3 avatar folder path |
| `JWT_EXPIRE` | JWT expiry (default: 7d) |
| `JWT_REFRESH_EXPIRE` | JWT refresh expiry (default: 30d) |
| `REDIS_ENABLED` | Enable Redis (true/false) |

## API Endpoints

- `POST /api/auth/*` — Authentication
- `GET/POST/PUT/DELETE /api/users/*` — User management
- `GET/POST/PUT/DELETE /api/conversations/*` — Conversations
- `GET/POST/PUT/DELETE /api/messages/*` — Messages

## License

MIT
