/**
 * Streaming ETL Control API
 *
 * Manages the stream-consumer supervisord service (strfry → Redis → Neo4j).
 * Provides status, start/stop control, queue depth monitoring, and log access.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const Redis = require('ioredis');

const CONSUMER_LOG = '/var/log/supervisor/stream-consumer.log';
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const QUEUE_NAME = 'strfry:events';

/**
 * Parse supervisorctl status output for the stream-consumer service.
 * Example output: "stream-consumer                  RUNNING   pid 155, uptime 0:08:34"
 */
function parseConsumerStatus() {
  try {
    const output = execSync('supervisorctl status stream-consumer 2>/dev/null', { encoding: 'utf8' }).trim();
    const match = output.match(/stream-consumer\s+(\S+)\s+(?:pid\s+(\d+),\s+uptime\s+(.+))?/);
    if (match) {
      return {
        status: match[1].toLowerCase(),
        pid: match[2] ? parseInt(match[2]) : null,
        uptime: match[3] || null,
      };
    }
    // FATAL or other state without pid/uptime
    const simpleMatch = output.match(/stream-consumer\s+(\S+)/);
    return {
      status: simpleMatch ? simpleMatch[1].toLowerCase() : 'unknown',
      pid: null,
      uptime: null,
    };
  } catch {
    return { status: 'unknown', pid: null, uptime: null };
  }
}

/**
 * Get Redis queue depth.
 */
async function getQueueDepth() {
  let redis;
  try {
    redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true, connectTimeout: 3000 });
    await redis.connect();
    const depth = await redis.llen(QUEUE_NAME);
    redis.disconnect();
    return depth;
  } catch {
    if (redis) redis.disconnect();
    return null;
  }
}

/**
 * Extract processed count from consumer log.
 * Looks for lines like: "[stream-consumer] ... Processed 1234 events (0 errors)"
 */
function getProcessedCount() {
  try {
    if (!fs.existsSync(CONSUMER_LOG)) return null;
    const content = fs.readFileSync(CONSUMER_LOG, 'utf8');
    const lines = content.split('\n').reverse();
    for (const line of lines) {
      const match = line.match(/Processed (\d+) events \((\d+) errors\)/);
      if (match) {
        return { processed: parseInt(match[1]), errors: parseInt(match[2]) };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/streaming-etl/status
 */
async function handleStatus(req, res) {
  try {
    const consumer = parseConsumerStatus();
    const depth = await getQueueDepth();
    const counts = getProcessedCount();

    return res.json({
      success: true,
      consumer,
      queue: { depth: depth != null ? depth : 'unavailable' },
      counts: counts || { processed: 0, errors: 0 },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/streaming-etl/control
 * Body: { action: "start" | "stop" | "restart" }
 */
function handleControl(req, res) {
  const { action } = req.body;
  const validActions = ['start', 'stop', 'restart'];

  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
  }

  try {
    const output = execSync(`supervisorctl ${action} stream-consumer 2>&1`, { encoding: 'utf8' }).trim();
    const consumer = parseConsumerStatus();
    return res.json({
      success: true,
      message: output,
      consumer,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Failed to ${action} stream-consumer: ${err.message}`,
    });
  }
}

/**
 * GET /api/streaming-etl/logs?lines=15
 */
function handleLogs(req, res) {
  const numLines = Math.min(parseInt(req.query.lines) || 15, 100);

  try {
    if (!fs.existsSync(CONSUMER_LOG)) {
      return res.json({ success: true, lines: [] });
    }
    const content = fs.readFileSync(CONSUMER_LOG, 'utf8');
    const allLines = content.split('\n').filter(l => l.trim());
    const lines = allLines.slice(-numLines);
    return res.json({ success: true, lines });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleStatus, handleControl, handleLogs };
