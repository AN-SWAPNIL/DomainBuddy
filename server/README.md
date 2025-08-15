# DomainBuddy Server

Express.js server for the DomainBuddy application with JWT authentication and Supabase database integration.

## Features

- **Authentication System**
  - User registration and login
  - JWT token-based authentication
  - Password hashing with bcrypt
  - Refresh token mechanism
  - Password reset functionality
  - Profile management

- **Security**
  - Helmet.js for security headers
  - CORS configuration
  - Rate limiting
  - Input validation with express-validator
  - Password strength requirements

- **Database**
  - Supabase PostgreSQL integration
  - Row Level Security (RLS)
  - Automatic timestamps
  - Token cleanup mechanisms

## Prerequisites

- Node.js 18+ 
- Supabase account and project
- NPM or Yarn

## Installation

1. **Navigate to server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables in `.env`**
   ```env
   NODE_ENV=development
   PORT=5000
   
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex
   JWT_EXPIRE=7d
   JWT_REFRESH_EXPIRE=30d
   
   # Client URL for CORS
   CLIENT_URL=http://localhost:5173
   ```

## Supabase Setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Run the database schema**
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `database/schema.sql`
   - Execute the SQL commands

3. **Get your credentials**
   - Project URL: Found in Settings > General
   - Anon Key: Found in Settings > API
   - Service Role Key: Found in Settings > API (keep this secret!)

## Database Schema

The application uses the following tables:

- **users**: User accounts with authentication data
- **refresh_tokens**: JWT refresh tokens for secure token renewal
- **password_resets**: Password reset tokens and tracking

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /register` - Register a new user
- `POST /login` - Login user
- `GET /me` - Get current user info
- `POST /logout` - Logout user
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token
- `PUT /password` - Update password (authenticated)
- `POST /refresh` - Refresh access token

### User Routes (`/api/user`)

- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `DELETE /account` - Delete user account

### Utility Routes

- `GET /health` - Health check endpoint
- `GET /api/test` - API test endpoint

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on the configured port (default: 5000).

## Request/Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if any)
  ]
}
```

## Authentication Flow

1. **Registration/Login**: Client receives access token and refresh token
2. **API Requests**: Include `Authorization: Bearer <access_token>` header
3. **Token Refresh**: Use refresh token to get new access token when expired
4. **Logout**: Invalidates all tokens for the user

## Security Features

- **Password Requirements**: Minimum 6 characters, must contain uppercase, lowercase, and number
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for client domains
- **Helmet**: Security headers automatically applied
- **Input Validation**: All inputs validated and sanitized

## Error Handling

The server includes comprehensive error handling:
- Validation errors return 400 with field-specific messages
- Authentication errors return 401
- Authorization errors return 403
- Not found errors return 404
- Server errors return 500

## Development

### Project Structure
```
src/
├── config/          # Database and configuration
├── controllers/     # Route handlers
├── middleware/      # Authentication, validation, error handling
├── routes/          # API routes
├── utils/           # Utility functions
└── server.js        # Main server file
```

### Adding New Routes

1. Create controller in `src/controllers/`
2. Add route definitions in `src/routes/`
3. Include validation middleware if needed
4. Register routes in `src/server.js`

## Testing

The health check endpoint can be used to verify the server is running:

```bash
curl http://localhost:5000/health
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure proper CORS origins
4. Set up SSL/TLS
5. Use process manager (PM2, etc.)
6. Configure reverse proxy (nginx, etc.)

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 5000 |
| SUPABASE_URL | Supabase project URL | Required |
| SUPABASE_ANON_KEY | Supabase anonymous key | Required |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key | Required |
| JWT_SECRET | JWT signing secret | Required |
| JWT_EXPIRE | Access token expiry | 7d |
| JWT_REFRESH_EXPIRE | Refresh token expiry | 30d |
| CLIENT_URL | Frontend URL for CORS | http://localhost:5173 |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 900000 (15 min) |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | 100 |

## License

This project is licensed under the ISC License.
