# 🌐 DomainBuddy

**AI-Powered Domain Buying Agent & Management Platform**

DomainBuddy is a comprehensive full-stack web application that revolutionizes the domain buying experience through AI-powered recommendations, automated registration, and intelligent portfolio management. The platform combines cutting-edge AI technology with seamless domain services to help individuals and businesses discover, analyze, and acquire the perfect domain names.

## 🚀 Features

### 🤖 AI-Powered Intelligence
- **AI Consultant Chat**: Interactive AI assistant for personalized domain recommendations
- **Smart Domain Suggestions**: AI-generated domain names based on business descriptions and keywords
- **Business Name Generator**: AI-powered business name suggestions with domain availability checks

### 🔍 Domain Discovery & Management
- **Advanced Search**: Real-time domain availability checking across multiple TLDs (.com, .net, .org, etc.)
- **Portfolio Dashboard**: Centralized management of owned domains with expiration tracking
- **DNS Management**: Complete DNS record management (A, CNAME, MX, TXT records) with real-time updates
- **Subdomain Manager**: Create and manage subdomains with automated DNS propagation tracking
- **Bulk Operations**: Mass domain operations and batch processing

### 🛡️ Security & Authentication
- **JWT Authentication**: Secure user authentication with refresh token management
- **Two-Factor Authentication**: Email-based OTP verification for sensitive operations like payment
- **Password Security**: Bcrypt hashing with secure password reset functionality
- **Profile Management**: Comprehensive user profiles with validation and security controls
- **Rate Limiting**: Built-in protection against abuse and spam

### 💳 Payment & Commerce
- **Stripe Integration**: Secure payment processing with test and production modes
- **OTP-Protected Purchases**: Email verification required before payment completion
- **Payment Intent Flow**: Secure payment processing with error handling and retry mechanisms
- **Invoice Generation**: Automated receipt generation and transaction history

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend**: Express.js + Node.js
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: JWT with refresh tokens
- **Payments**: Stripe API integration
- **Domain API**: Namecheap API for domain operations
- **AI/ML**: Google Generative AI + LangChain for intelligent recommendations
- **Email**: Nodemailer for transactional emails

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server │    │   Supabase DB   │
│                 │◄──►│                 │◄──►│                 │
│  - UI/UX        │    │  - API Routes   │    │  - PostgreSQL   │
│  - State Mgmt   │    │  - Auth Layer   │    │  - RLS Security │
│  - Routing      │    │  - Validation   │    │  - Migrations   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External APIs │    │   AI Services   │    │  Background Jobs│
│                 │    │                 │    │                 │
│  - Stripe       │    │  - LangChain    │    │  - DNS Updates  │
│  - Namecheap    │    │  - Google AI    │    │  - Email Queue  │
│  - Email SMTP   │    │  - Domain Tools │    │  - Monitoring   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Project Structure
```
DomainBuddy/
├── client/                 # React Frontend Application
│   ├── public/            # Static assets and icons
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── auth/      # Authentication components
│   │   │   ├── domains/   # Domain-specific components
│   │   │   ├── layout/    # Layout and navigation
│   │   │   └── ui/        # Generic UI components
│   │   ├── contexts/      # React Context providers
│   │   ├── pages/         # Application pages/routes
│   │   ├── services/      # API integration services
│   │   └── utils/         # Utility functions and helpers
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Build configuration
├── server/                # Express.js Backend Application
│   ├── database/          # SQL migration files
│   ├── scripts/           # Database and utility scripts
│   ├── src/
│   │   ├── config/        # Database and app configuration
│   │   ├── controllers/   # Route handler logic
│   │   ├── middleware/    # Authentication and validation
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Business logic and external APIs
│   │   └── utils/         # Backend utility functions
│   ├── package.json       # Backend dependencies
│   └── .env.example       # Environment variables template
├── README.md              # This file
└── .gitignore            # Git ignore patterns
```

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Git**: For version control
- **Supabase Account**: For database hosting
- **Stripe Account**: For payment processing
- **Namecheap Account**: For domain operations (sandbox for testing)

### Environment Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/AN-SWAPNIL/DomainBuddy.git
   cd DomainBuddy
   ```

2. **Backend Setup**
   ```bash
   cd server
   npm install
   
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

3. **Frontend Setup**
   ```bash
   cd ../client
   npm install

   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

### Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (Supabase)
DATABASE_URL=your_supabase_database_url
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# Stripe Payment Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Namecheap API Configuration
NAMECHEAP_API_USER=your_namecheap_username
NAMECHEAP_API_KEY=your_namecheap_api_key
NAMECHEAP_CLIENT_IP=your_whitelisted_ip
NAMECHEAP_SANDBOX=true

# Google AI Configuration
GOOGLE_API_KEY=your_google_generative_ai_key

# Email Configuration
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email_username
SMTP_PASS=your_email_password
FROM_EMAIL=noreply@domainbuddy.com

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_SALT_ROUNDS=12
```

### Database Setup

1. **Create Supabase Project**
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Copy the project URL and API keys

2. **Create the database tables**
   - Sign in at [supabase.com](https://supabase.com)
   - Navigate to your projects SQL editor
   - Copy the SQL commands located in /server/database and run them in the SQL editor sequentially

3. **Verify Database Tables**
   - Check Supabase dashboard for created tables
   - Ensure Row Level Security policies are active (recommended but not necessary to run the project)

## 🚀 Running the Application

### Development Mode

1. **Start the Backend Server**
   ```bash
   cd server
   npm run dev
   ```
   Server will run on `http://localhost:5001`

2. **Start the Frontend Application**
   ```bash
   cd client
   npm run dev
   ```
   Client will run on `http://localhost:5173`

3. **Access the Application**
   - Open your browser to `http://localhost:5173`
   - Register a new account or use test credentials
   - Start exploring domain search and AI features


## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation

### Domain Endpoints
- `GET /api/domains/search` - Search available domains
- `POST /api/domains/purchase` - Purchase a domain
- `GET /api/domains/my-domains` - Get user's domains
- `GET /api/domains/:id` - Get domain details
- `PUT /api/domains/:id/dns` - Update DNS records

### AI Endpoints
- `POST /api/ai/chat` - AI consultant chat
- `POST /api/ai/suggest-domains` - Get AI domain suggestions
- `POST /api/ai/analyze-domain` - Analyze domain value

### Payment Endpoints
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment



## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.


---

**Built with ❤️ by the DomainBuddy Team**
