/**
 * Where a person edits and publishes their assistant's profile: the Edit Assistant Profile page
 * (assistant-management #1, ADR 0001 sub-decision 6).
 *
 * The UI's constant for it is MY_ASSISTANT_PATH (ui/src/config/avatarMenuLinks.js), an ES module the server
 * cannot require, so the server keeps this second home for the refusals that name the page. The legacy
 * panels (public/pages/nip85.html, public/pages/customers/customer.html) write the address out.
 * test/assistant-management-page.test.js keeps every home equal: move the page, and move them together.
 */

const EDIT_ASSISTANT_PROFILE_PATH = '/assistant/profile/edit';
const EDIT_ASSISTANT_PROFILE_PAGE = `the Edit Assistant Profile page (${EDIT_ASSISTANT_PROFILE_PATH})`;

module.exports = { EDIT_ASSISTANT_PROFILE_PATH, EDIT_ASSISTANT_PROFILE_PAGE };
