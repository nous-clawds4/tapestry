const { chromium } = require('@playwright/test');

/**
 * Global setup for Brainstorm Playwright tests
 * Handles authentication and environment preparation
 */
async function globalSetup(config) {
  console.log('🚀 Starting Brainstorm test suite global setup...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Check if Brainstorm server is accessible. Newer Playwright exposes `use`
    // per-project rather than at the top of the FullConfig, so resolve baseURL
    // defensively (top-level use → first project's use → env → default).
    const baseURL = config?.use?.baseURL
      || config?.projects?.[0]?.use?.baseURL
      || process.env.BRAINSTORM_BASE_URL
      || 'http://localhost:7778';
    console.log(`📡 Checking Brainstorm server accessibility at ${baseURL}`);
    
    const response = await page.goto(baseURL, { waitUntil: 'networkidle' });
    
    if (!response || !response.ok()) {
      throw new Error(`Brainstorm server not accessible at ${baseURL}. Status: ${response?.status()}`);
    }
    
    console.log('✅ Brainstorm server is accessible');
    
    // Check if Neo4j health endpoint is working
    try {
      await page.goto(`${baseURL}/api/neo4j-health`);
      console.log('✅ Neo4j health endpoint is accessible');
    } catch (error) {
      console.warn('⚠️  Neo4j health endpoint check failed:', error.message);
    }
    
    // Store environment info for tests
    process.env.BRAINSTORM_SERVER_ACCESSIBLE = 'true';
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    process.env.BRAINSTORM_SERVER_ACCESSIBLE = 'false';
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = globalSetup;
