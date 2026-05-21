/**
 * BullBoard mount — operator-facing UI at /admin/queues.
 * Story #13 / ADR 0010.
 *
 * Mounted behind requireOwnerOnly (or requireOwner — the auth middleware is
 * passed in by api/index.js to avoid a brittle relative-path import of
 * `./admin` from down here). retry / remove / pause controls can affect
 * running calculations; the owner-only gate prevents accidental damage.
 *
 * The BullBoard packages (`@bull-board/api`, `@bull-board/express`) are
 * required LAZILY inside `mountBullBoard` so that if the packages aren't
 * installed (e.g., npm install hasn't run yet during dev), the module file
 * itself still loads — the mount throws only when actually called.
 */

/**
 * Mount BullBoard.
 *
 * @param {import('express').Application} app
 * @param {{ queues: any[], requireOwnerOnly: import('express').RequestHandler }} opts
 */
function mountBullBoard(app, { queues, requireOwnerOnly }) {
  if (!Array.isArray(queues) || queues.length === 0) {
    console.warn('[bull-board] mountBullBoard called with no queues — skipping mount.');
    return;
  }
  if (typeof requireOwnerOnly !== 'function') {
    throw new Error('mountBullBoard requires requireOwnerOnly middleware');
  }

  // Lazy require so module load doesn't depend on deps being installed.
  const { createBullBoard } = require('@bull-board/api');
  const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
  const { ExpressAdapter } = require('@bull-board/express');

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'Tapestry Task Queue — Owner Only',
        boardLogo: { path: '' },
        miscLinks: []
      }
    }
  });

  app.use('/admin/queues', requireOwnerOnly, serverAdapter.getRouter());
  console.log('[bull-board] Mounted at /admin/queues (owner-only)');
}

module.exports = { mountBullBoard };
