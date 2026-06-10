/**
 * BullBoard mount — operator-facing UI at /admin/queues.
 * Story #13 / ADR 0010 introduced the mount; story #18 / ADR 0016 widened
 * the gate from owner-only to owner+admin.
 *
 * The auth middleware is passed in by api/index.js (as `authMiddleware`) to
 * avoid a brittle relative-path import of `./admin` from down here. The
 * caller is responsible for picking which middleware to pass: today it's
 * requireOwnerOrAdmin (story #18); before story #18 it was requireOwnerOnly.
 * retry / remove / pause controls can affect running calculations; the
 * caller-supplied gate is what protects them.
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
 * @param {{ queues: any[], authMiddleware: import('express').RequestHandler }} opts
 */
function mountBullBoard(app, { queues, authMiddleware }) {
  if (!Array.isArray(queues) || queues.length === 0) {
    console.warn('[bull-board] mountBullBoard called with no queues — skipping mount.');
    return;
  }
  if (typeof authMiddleware !== 'function') {
    throw new Error('mountBullBoard requires authMiddleware function');
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
        boardTitle: 'Tapestry Task Queue — Owner + Admin',
        boardLogo: { path: '' },
        // Story #19 / ADR 0017 — back-link from BullBoard's header to the
        // Tapestry dashboard so operators close the navigation loop.
        miscLinks: [
          { text: '← Tapestry Dashboard', url: '/tapestry' }
        ]
      }
    }
  });

  app.use('/admin/queues', authMiddleware, serverAdapter.getRouter());
  console.log('[bull-board] Mounted at /admin/queues (owner+admin)');
}

module.exports = { mountBullBoard };
