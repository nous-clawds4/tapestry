'use strict';
/**
 * The Assistant Duties routes (assistant-duties-settings #1, ADR assistant-duties-settings/0001 sub-decision 4): the
 * duties every Assistant on this instance offers on its Duty Menu, read and changed by the Owner or an Admin from the
 * Settings page's Assistant Duties tab.
 *
 *   GET  /api/settings/assistant-duties        { success: true, duties }: the list the offer uses (readDutyList)
 *   PUT  /api/settings/assistant-duties        body { duties }: the whole list, checked by validateDutyList and stored
 *                                              normalized; a refusal is 400 { success: false, code, index }, nothing written
 *   POST /api/settings/assistant-duties/reset  the override removed, so the shipped six apply; answers as the GET
 *
 * The list lives under `assistantDuties` in the two-layer settings (src/config/settings.js): the shipped six in
 * defaults.json, a saved list in the volume's settings.json. Registered behind requireOwner (src/api/index.js), which
 * admits the Owner and Admins. The rule is src/lib/duty-menu's, shared with the generic PUT /api/settings and the offer.
 * The settings functions are injectable (createAssistantDutiesHandlers(deps)) so suites run stack-free.
 */

const { validateDutyList, readDutyList } = require('../../lib/duty-menu');

const SETTINGS_KEY = 'assistantDuties';

function defaultDeps() {
  const settings = require('../../config/settings');
  return {
    getSettings: () => settings.getSettings(),
    updateOverrides: (patch) => settings.updateOverrides(patch),
    resetOverride: (keyPath) => settings.resetOverride(keyPath),
  };
}

/** The list the offer uses now: the merged settings' list, cleaned as every reader cleans it. */
function currentDuties(d) {
  return readDutyList((d.getSettings() || {})[SETTINGS_KEY]).duties;
}

function failed(res, err) {
  console.error('[settings/assistant-duties]', err && err.message ? err.message : err);
  return res.status(500).json({ success: false, error: 'Could not read or write the Assistant Duties settings' });
}

/**
 * The three handlers over the given settings functions.
 * @param {{ getSettings?: Function, updateOverrides?: Function, resetOverride?: Function }} deps
 * @returns {{ get: Function, put: Function, reset: Function }}
 */
function createAssistantDutiesHandlers(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  return {
    get(req, res) {
      try {
        return res.json({ success: true, duties: currentDuties(d) });
      } catch (err) { return failed(res, err); }
    },
    put(req, res) {
      try {
        const body = req && req.body && typeof req.body === 'object' ? req.body : {};
        const checked = validateDutyList(body.duties);
        if (!checked.ok) return res.status(400).json({ success: false, code: checked.code, index: checked.index });
        d.updateOverrides({ [SETTINGS_KEY]: checked.duties });
        return res.json({ success: true, duties: checked.duties });
      } catch (err) { return failed(res, err); }
    },
    reset(req, res) {
      try {
        d.resetOverride(SETTINGS_KEY);
        return res.json({ success: true, duties: currentDuties(d) });
      } catch (err) { return failed(res, err); }
    },
  };
}

const handlers = createAssistantDutiesHandlers();

module.exports = {
  createAssistantDutiesHandlers,
  handleGetAssistantDuties: (req, res) => handlers.get(req, res),
  handleUpdateAssistantDuties: (req, res) => handlers.put(req, res),
  handleResetAssistantDuties: (req, res) => handlers.reset(req, res),
  SETTINGS_KEY,
};
