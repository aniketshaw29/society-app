import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { validateEnv, config } from './config';
import healthRouter from './routes/health';
import societiesRouter from './routes/societies';
import onboardingRouter from './routes/onboarding';
import visitorsRouter from './routes/visitors';
import preApprovalsRouter from './routes/preApprovals';
import recurringStaffRouter from './routes/recurringStaff';
import sosRouter from './routes/sos';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// ============================================================
// Validate environment variables before anything else
// ============================================================
validateEnv();

const app = express();

// ============================================================
// Security middleware
// ============================================================
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, mobile apps, curl)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        config.FRONTEND_URL,
        // Allow localhost variants in dev/test
        ...(config.NODE_ENV !== 'production'
          ? ['http://localhost:3000', 'http://localhost:8081', 'http://127.0.0.1:3000']
          : []),
      ];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ============================================================
// Rate limiting
// ============================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again later.',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
  },
});

app.use(globalLimiter);

// ============================================================
// Body parsing
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// Request ID (useful for log tracing)
// ============================================================
app.use((req, _res, next) => {
  req.headers['x-request-id'] =
    req.headers['x-request-id'] ??
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  next();
});

// ============================================================
// Routes
// ============================================================

// Health checks (no auth required)
app.use('/health', healthRouter);

// Auth rate limit on any future /auth routes
app.use('/auth', authLimiter);

// ============================================================
// Feature routes
// ============================================================

// Society self-registration + invite code lookup + join
app.use('/societies', societiesRouter);

// Admin onboarding: buildings, flats, residents, guards
// Routes are mounted at /onboarding/societies/:societyId/...
app.use('/onboarding', onboardingRouter);

// Visitor management: guard logs entry, residents approve/deny
app.use('/visitors', visitorsRouter);

// Pre-approvals: residents pre-approve guests with OTP; guards verify at gate
app.use('/pre-approvals', preApprovalsRouter);

// Recurring staff management: residents manage daily staff, guards log entries
app.use('/recurring-staff', recurringStaffRouter);

// SOS alerts: residents trigger emergency, guards/admins resolve
app.use('/sos', sosRouter);

// Authenticated example — exposes auth middleware for use in tests
app.get('/api/v1/me', authenticate, (req, res) => {
  res.status(200).json({ data: req.user });
});

// ============================================================
// 404 + error handlers (must be last)
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// Server startup
// ============================================================
const PORT = config.PORT;

const server = app.listen(PORT, () => {
  console.log(
    `[Server] Society App Backend running on port ${PORT} (${config.NODE_ENV})`
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received — shutting down');
  server.close(() => process.exit(0));
});

export default app;
