#!/usr/bin/env node

/**
 * Brainstorm Control Panel
 * 
 * This script starts the Brainstorm Control Panel web interface
 * and API server for managing NIP-85 data generation and publication.
 */

// Load secure storage environment variables first
const fs = require('fs');
const path = require('path');

// Try multiple possible locations for the secure storage config
const configPaths = [
    '/etc/brainstorm/secure-storage.env',
    path.join(process.env.HOME || '/root', '.brainstorm/secure-storage.env'),
    path.join(__dirname, '../config/secure-storage.env')
];

let configLoaded = false;
for (const configPath of configPaths) {
    try {
        if (fs.existsSync(configPath)) {
            require('dotenv').config({ path: configPath });
            console.log(`✅ Loaded secure storage configuration from: ${configPath}`);
            configLoaded = true;
            break;
        }
    } catch (error) {
        // Continue to next path
    }
}

if (!configLoaded) {
    console.log('⚠️  Secure storage config not found - using environment defaults');
    console.log('   Run setup/setup-secure-storage.sh to configure secure storage');
}

const express = require('express');
const https = require('https');
const http = require('http');
const session = require('express-session');
const cors = require('cors');
const WebSocket = require('ws');
const { useWebSocketImplementation } = require('nostr-tools/pool');
const { authMiddleware } = require('../src/middleware/auth');
require('websocket-polyfill');

useWebSocketImplementation(WebSocket);

// Import API modules
const api = require('../src/api');

// Import centralized configuration utility
const { getConfigFromFile } = require('../src/utils/config');

// Determine if we should use HTTPS (local development) or HTTP (behind proxy)
let useHTTPS = process.env.USE_HTTPS === 'true';

try {
    console.log('Using HTTPS: ', useHTTPS);
  } catch (e) {
    console.error('Top-level error:', e);
  }

// Only load certificates if using HTTPS
let credentials = null;
if (useHTTPS) {
  try {
    const privateKey = fs.readFileSync(path.join(process.env.HOME, '.ssl', 'localhost.key'), 'utf8');
    const certificate = fs.readFileSync(path.join(process.env.HOME, '.ssl', 'localhost.crt'), 'utf8');
    credentials = { key: privateKey, cert: certificate };
    console.log('HTTPS credentials loaded successfully');
  } catch (error) {
    console.warn(`Warning: Could not load SSL certificates: ${error.message}`);
    console.warn('Falling back to HTTP mode');
    useHTTPS = false;
  }
}

// Import configuration
let config;
try {
  const configModule = require('../lib/config');
  config = configModule.getAll();
} catch (error) {
  console.warn('Could not load configuration:', error.message);
  config = {};
}

// Function to get Neo4j connection details
function getNeo4jConnection() {
  // Try to get from config module first
  if (config && config.neo4j) {
    return config.neo4j;
  }
  
  // Fall back to direct file access
  return {
    uri: getConfigFromFile('NEO4J_URI', 'bolt://localhost:7687'),
    user: getConfigFromFile('NEO4J_USER', 'neo4j'),
    password: getConfigFromFile('NEO4J_PASSWORD')
  };
}

// Create Express app
const app = express();
const port = process.env.CONTROL_PANEL_PORT || 7778;

// Middleware
// Configure CORS to allow cross-origin requests
app.use(cors({
    origin: true, // Allow all origins
    credentials: true, // Allow credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve React SPA assets (JS, CSS, SVG, fonts) from Vite build output
app.use(express.static(path.join(__dirname, '../dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.set('Content-Type', 'text/css');
        else if (filePath.endsWith('.js')) res.set('Content-Type', 'text/javascript');
    }
}));

// Serve static files from the public directory (legacy assets: CSS, JS, images)
app.use(express.static(path.join(__dirname, '../public'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.css')) {
            console.log('Setting CSS MIME type for:', path);
            res.set('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            console.log('Setting JS MIME type for:', path);
            res.set('Content-Type', 'text/javascript');
        }
    }
}));

// Serve static files under /control/ prefix (for nginx-less local/Docker setups)
app.use('/control', express.static(path.join(__dirname, '../public')));

// Serve public assets under /legacy/ so relative paths in legacy HTML pages
// (e.g. ./components/header/header.js, ./css/common.css) resolve correctly.
app.use('/legacy', express.static(path.join(__dirname, '../public')));

// Serve generated assistant composite avatars (ta-avatar #3, ADR 0003).
// This is the only directory that is BOTH persisted (the tapestry-data volume at
// /var/lib/brainstorm, docker-compose.yml) and web-served — a published kind 0
// names a URL here, so it must survive redeploys and be fetchable without auth.
// Only the owner-gated upload writes here, under server-generated content-hash
// filenames, so a caller cannot choose a path. No directory index.
app.use('/generated', express.static('/var/lib/brainstorm/generated', {
    index: false,
    fallthrough: true,
    maxAge: '7d',
}));

// Serve Chart.js from node_modules
app.use('/libs/chart.js', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));
app.use('/libs/chartjs-adapter-date-fns', express.static(path.join(__dirname, '../node_modules/chartjs-adapter-date-fns/dist')));

// Session middleware — Redis-backed so sessions survive Docker rebuilds.
const RedisStore = require('connect-redis').default;
const Redis = require('ioredis');
const sessionRedisHost = getConfigFromFile('REDIS_HOST', 'redis');
const sessionRedisPort = parseInt(getConfigFromFile('REDIS_PORT', '6379'), 10);
const sessionRedisClient = new Redis({ host: sessionRedisHost, port: sessionRedisPort });
sessionRedisClient.on('error', (err) => console.error('Session-store Redis error:', err.message));
app.use(session({
    store: new RedisStore({ client: sessionRedisClient, prefix: 'brainstorm:sess:' }),
    secret: getConfigFromFile('SESSION_SECRET', 'brainstorm-default-session-secret-please-change-in-production'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: useHTTPS,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
}));

// Helper function to serve HTML files
function serveHtmlFile(filename, res) {
    console.log(`[SERVER] Attempting to serve file: ${filename}`);
    
    try {
        // Build all possible file paths to check
        const customersPath = path.join(__dirname, '../public/pages/customers', filename);
        const managePath = path.join(__dirname, '../public/pages/manage', filename);
        const pagesPath = path.join(__dirname, '../public/pages', filename);
        const originalPath = path.join(__dirname, '../public', filename);
        
        console.log(`[SERVER] Checking paths:
            Pages path: ${pagesPath}
            Original path: ${originalPath}`);
        
        // Check if files exist
        const customersExists = fs.existsSync(customersPath);
        const manageExists = fs.existsSync(managePath);
        const pagesExists = fs.existsSync(pagesPath);
        const originalExists = fs.existsSync(originalPath);
        
        console.log(`[SERVER] File existence:
            In customers directory: ${customersExists}
            In manage directory: ${manageExists}
            In pages directory: ${pagesExists}
            In original directory: ${originalExists}`);
        
        // Determine which file to serve
        if (customersExists) {
            console.log(`[SERVER] Serving from customers directory: ${customersPath}`);
            res.sendFile(customersPath);
        } else if (manageExists) {
            console.log(`[SERVER] Serving from manage directory: ${managePath}`);
            res.sendFile(managePath);
        } else if (pagesExists) {
            console.log(`[SERVER] Serving from pages directory: ${pagesPath}`);
            res.sendFile(pagesPath);
        } else if (originalExists) {
            console.log(`[SERVER] Serving from original directory: ${originalPath}`);
            res.sendFile(originalPath);
        } else {
            console.log(`[SERVER] File not found in either location: ${filename}`);
            res.status(404).send(`File not found: ${filename}<br>
                Checked pages path: ${pagesPath}<br>
                Checked original path: ${originalPath}`);
        }
    } catch (error) {
        console.error(`[SERVER] Error serving HTML file: ${error.message}`);
        res.status(500).send(`Internal server error: ${error.message}`);
    }
}

// Legacy Brainstorm pages — served under /legacy/
app.get('/legacy', (req, res) => {
    serveHtmlFile('index.html', res);
});
app.get('/legacy/:filename.html', (req, res) => {
    const filename = req.params.filename + '.html';
    console.log(`[SERVER] Legacy route hit: /legacy/${filename}`);
    serveHtmlFile(filename, res);
});

// Redirect bare /*.html requests to /legacy/*.html so internal links in
// legacy HTML pages work without modification. Preserves query string.
// Use 302 (not 301) — browsers cache 301 redirects permanently, which
// causes query-string parameters to be lost on subsequent requests.
app.get('/:filename.html', (req, res) => {
    const qs = req._parsedUrl.search || '';
    res.redirect(302, `/legacy/${req.params.filename}.html${qs}`);
});

// Swagger UI — serve OpenAPI docs at /docs (before auth so docs are public)
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const openapiSpec = yaml.load(fs.readFileSync(path.join(__dirname, '../src/api/openapi.yaml'), 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: 'Tapestry API Docs',
}));

// Apply auth middleware
app.use(authMiddleware);

// Register API modules (async — loads TA key from secure storage) then start server
(async () => {
  // Initialize the BullMQ task queue (story #13 / ADR 0010) BEFORE api.register
  // so the BullBoard mount inside api/index.js sees a populated queue list
  // (getAllQueues() returns the in-flight Queues, not []).
  // Gated on TASK_QUEUE_ENABLED — when off, the queue is never constructed
  // and the legacy direct-spawn path in /api/run-task runs unchanged
  // (that IS the rollback path).
  const taskQueueEnabled = getConfigFromFile('TASK_QUEUE_ENABLED', 'false') === 'true';
  if (taskQueueEnabled) {
    try {
      const taskQueue = require('../src/manage/taskQueue/queue');
      await taskQueue.initTaskQueue();
      console.log('Task queue initialized (TASK_QUEUE_ENABLED=true)');
    } catch (e) {
      console.error(`Failed to initialize task queue: ${e.message}`);
      console.error('Continuing without queue — /api/run-task will return 503 QUEUE_UNAVAILABLE');
    }
  } else {
    console.log('Task queue disabled (TASK_QUEUE_ENABLED=false) — legacy direct-spawn path active');
  }

  await api.register(app);
  console.log('API routes registered');

  // Reconcile recurring schedules into BullMQ Job Schedulers (story #22 / ADR 0019).
  // Replaces the in-process setInterval scheduler. Requires the queue, so it is
  // gated on TASK_QUEUE_ENABLED and runs after initTaskQueue + api.register.
  if (taskQueueEnabled) {
    try {
      const scheduledTasks = require('../src/api/scheduled-tasks');
      await scheduledTasks.reconcileSchedulesFromConfig();
      console.log('Scheduled tasks reconciled into BullMQ Job Schedulers');
    } catch (e) {
      console.error(`Failed to reconcile scheduled tasks: ${e.message}`);
    }
  } else {
    console.log('Task queue disabled — recurring scheduler not started (scheduling requires the queue)');
  }

  // SPA catch-all: any route that didn't match a static file, API endpoint, or legacy page
  // gets served the React app's index.html so client-side routing works on refresh.
  app.get('*', (req, res, next) => {
    // Don't catch API routes (already handled above)
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });

  if (useHTTPS) {
    console.log('Starting in HTTPS mode with credentials:', {
      keyLength: credentials.key.length,
      certLength: credentials.cert.length
    });
    const httpsServer = https.createServer(credentials, app);
    httpsServer.on('error', (err) => {
      console.error('HTTPS server error:', err);
    });
    httpsServer.listen(port, () => {
      console.log(`Brainstorm Control Panel running on HTTPS port ${port}`);
    });
  } else {
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
      console.log(`Brainstorm Control Panel running on HTTP port ${port}`);
    });
  }
})().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown: close Neo4j Bolt driver
const { closeDriver } = require('../src/lib/neo4j-driver');
process.on('SIGTERM', async () => { await closeDriver(); process.exit(0); });
process.on('SIGINT', async () => { await closeDriver(); process.exit(0); });

// Export utility functions for testing and reuse
module.exports = {
    getConfigFromFile,
    getNeo4jConnection
};