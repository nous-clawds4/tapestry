/**
 * GET /api/strfry/router-status
 *
 * Returns the strfry router status: process state, config, and stream info.
 */
const { exec } = require('child_process');
const fs = require('fs');

const ROUTER_CONFIG_PATH = '/etc/strfry-router-tapestry.config';
const ROUTER_DEFAULT_PATH = '/etc/strfry-router-tapestry.config.default';

function parseRouterConfig(raw) {
  // Strip comments
  const stripped = raw.replace(/##[^\n]*/g, '');
  
  // Find the streams { ... } block using brace counting
  const streamsIdx = stripped.indexOf('streams');
  if (streamsIdx === -1) return [];
  
  function extractBlock(str, startIdx) {
    const openIdx = str.indexOf('{', startIdx);
    if (openIdx === -1) return null;
    let depth = 1;
    let i = openIdx + 1;
    while (i < str.length && depth > 0) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') depth--;
      i++;
    }
    return { content: str.slice(openIdx + 1, i - 1), end: i };
  }
  
  const streamsBlock = extractBlock(stripped, streamsIdx);
  if (!streamsBlock) return [];
  
  // Find each named stream block within streams
  const streams = [];
  const nameRegex = /(\w+)\s*\{/g;
  let match;
  
  while ((match = nameRegex.exec(streamsBlock.content)) !== null) {
    const name = match[1];
    const block = extractBlock(streamsBlock.content, match.index + name.length);
    if (!block) continue;
    
    // Skip past this block for the next iteration
    nameRegex.lastIndex = match.index + name.length + block.content.length + 2;
    
    const body = block.content;
    
    const dirMatch = body.match(/dir\s*=\s*"([^"]+)"/);
    const filterMatch = body.match(/filter\s*=\s*(\{[^}]+\})/);
    const urlsMatch = body.match(/urls\s*=\s*\[([\s\S]*?)\]/);
    
    const urls = [];
    if (urlsMatch) {
      const urlRegex = /"([^"]+)"/g;
      let u;
      while ((u = urlRegex.exec(urlsMatch[1])) !== null) {
        urls.push(u[1]);
      }
    }
    
    let filter = null;
    if (filterMatch) {
      try { filter = JSON.parse(filterMatch[1]); } catch {}
    }
    
    streams.push({
      name,
      dir: dirMatch ? dirMatch[1] : 'unknown',
      filter,
      urls,
    });
  }
  
  return streams;
}

async function handleRouterStatus(req, res) {
  try {
    // Get supervisor status
    const processStatus = await new Promise((resolve) => {
      exec('supervisorctl status strfry-router', { timeout: 5000 }, (err, stdout) => {
        if (err && !stdout) {
          resolve({ status: 'unknown', detail: err.message });
          return;
        }
        const line = (stdout || '').trim();
        if (line.includes('RUNNING')) {
          const uptimeMatch = line.match(/uptime\s+(\S+)/);
          resolve({ status: 'running', uptime: uptimeMatch ? uptimeMatch[1] : null });
        } else if (line.includes('STOPPED')) {
          resolve({ status: 'stopped' });
        } else if (line.includes('FATAL')) {
          resolve({ status: 'fatal', detail: line });
        } else {
          resolve({ status: 'unknown', detail: line });
        }
      });
    });

    // Read and parse config
    let streams = [];
    let configExists = false;
    try {
      const raw = fs.readFileSync(ROUTER_CONFIG_PATH, 'utf8');
      configExists = true;
      streams = parseRouterConfig(raw);
    } catch (err) {
      // Config file missing or unreadable
    }

    res.json({
      success: true,
      router: {
        process: processStatus,
        configPath: ROUTER_CONFIG_PATH,
        configExists,
        streams,
      },
    });
  } catch (err) {
    console.error('handleRouterStatus error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/strfry/router-defaults
 * Returns the default streams from the backup config.
 */
async function handleRouterDefaults(req, res) {
  try {
    if (!fs.existsSync(ROUTER_DEFAULT_PATH)) {
      return res.status(404).json({ success: false, error: 'No default config backup found.' });
    }
    const raw = fs.readFileSync(ROUTER_DEFAULT_PATH, 'utf8');
    const streams = parseRouterConfig(raw);
    res.json({ success: true, streams });
  } catch (err) {
    console.error('handleRouterDefaults error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleRouterStatus, handleRouterDefaults };
