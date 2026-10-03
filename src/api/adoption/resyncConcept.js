/**
 * POST /api/dictionaries/concepts/resync — Re-Sync a Dictionary concept (the owner's request of 2026-10-02):
 * the caller's own Assistant rebuilds a header it wrote, from scratch, from the shared concept that header
 * is wired to, e.g. after the shared concept was edited.
 *
 *   body: { coord, basedOn, copyFrom }
 *
 * `coord` is the header's address (39998:<the caller's Assistant>:<d>), `basedOn` the id of its version the
 * entry page showed, and `copyFrom` the id of the shared header's version the page's summary of changes was
 * made from. The new version is src/lib/conceptHeaderCopy.js resyncedHeaderTags: the shared header's names,
 * description and tags by the copy rule, the local address, the local json / concept-graph / z (the owner's
 * choice), and one b-tag, at the shared concept.
 *
 * Edit's rules (./editConcept.js, whose helpers this reuses), in order: the same host, a verified session,
 * the caller's own Assistant keys, the header must be that Assistant's, the latest verified version at
 * exactly that address must be the one the page showed (409 `changed`). Then the shared concept: the
 * header's wiredTarget (400 `not-wired` without one), and `copyFrom` read as Create New Concept reads it
 * (./newConcept.js readSource: this instance's relay, else the community relay strictly; it must verify and
 * be at that target, else 409 `source-missing`, 400 `source-mismatch` or 502 `source-unreachable`). The
 * names and description it brings must pass Edit's field checks (400 `source-invalid`), and a rename it
 * brings is refused as Edit refuses one (`name-keyed`, `name-taken`). No tag removed or added (the
 * page's "Already in sync"): answered without signing. Then sign, the local relay, the read-back, and the graph where it holds the header.
 * Nothing is broadcast here; the browser sends the new version to the community relay.
 */

'use strict';

const { resyncedHeaderTags, wiredTarget, tagDiff } = require('../../lib/conceptHeaderCopy');
const { checkEditFields } = require('../../lib/conceptHeaderEdit');
const edit = require('./editConcept');
const { readSource, readCommunity } = require('./newConcept');

const ROUTE = '/api/dictionaries/concepts/resync';
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

function defaultDeps() {
  return { ...edit.defaultDeps(), readCommunity };
}

/** The unsigned new version: the rebuilt tags, after the version it replaces. */
function composeResync(latest, source, target, now) {
  return {
    kind: edit.HEADER_KIND,
    created_at: Math.max(now, (latest.created_at || 0) + 1),
    content: '',
    tags: resyncedHeaderTags({ local: latest, source, target }),
  };
}

function createResyncConceptHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  return async function handleResyncConcept(req, res) {
    try {
      const who = await edit.callerAndAddress(d, req, res, 're-sync');
      if (who.answered) return;
      if (who.status) return res.status(who.status).json(who.body);
      const { keys, coord, dTag, basedOn, body } = who;

      const copyFrom = typeof body.copyFrom === 'string' ? body.copyFrom : '';
      if (!EVENT_ID_RE.test(copyFrom)) return res.status(400).json({ success: false, error: "copyFrom must be the shared header's event id" });

      const v = await edit.latestVersion(d, keys, coord, dTag, basedOn, 're-sync');
      if (!v.latest) return res.status(v.status).json(v.body);
      const { latest } = v;

      const target = wiredTarget(latest);
      if (!target) {
        return res.status(400).json({ success: false, code: 'not-wired', error: "This concept isn't wired to a shared concept, so there's nothing to re-sync from" });
      }
      const read = await readSource(d, copyFrom, target);
      if (!read.event) {
        const status = read.code === 'source-missing' ? 409 : read.code === 'source-unreachable' ? 502 : 400;
        return res.status(status).json({ success: false, code: read.code, error: read.error });
      }

      const template = composeResync(latest, read.event, target, d.now());
      // The names and description come from someone else's header: they meet the checks Edit and Create
      // apply to a person's own (both names, no control or text-direction characters), or nothing is signed.
      const names = template.tags.find((t) => t[0] === 'names') || [];
      const desc = template.tags.find((t) => t[0] === 'description') || [];
      const checked = checkEditFields({ singular: names[1], plural: names[2], description: desc[1] });
      if (checked.error) {
        return res.status(400).json({
          success: false, code: 'source-invalid',
          error: `The shared concept's header can't be copied as it is: ${checked.error}`,
        });
      }
      const refused = await edit.renameRefusal(d, keys, dTag, latest, checked.fields.singular);
      if (refused) return res.status(refused.status).json(refused.body);

      // No change is what the page's summary calls one: no tag removed or added (order alone isn't one).
      const diff = tagDiff(latest.tags || [], template.tags);
      if (!diff.removed.length && !diff.added.length && (latest.content || '') === '') {
        return res.json({ success: true, unchanged: true, event: latest, coord });
      }
      const out = await edit.signAndFollow(d, keys, template, coord, 'dictionaries/concepts/resync');
      return res.status(out.status).json(out.body);
    } catch (err) {
      console.error('dictionaries/concepts/resync error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

function register(app) {
  app.post(ROUTE, createResyncConceptHandler());
}

module.exports = { ROUTE, composeResync, createResyncConceptHandler, register };
