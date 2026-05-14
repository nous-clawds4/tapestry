/*
 * Communities REST API entry point.
 *
 * Registered routes:
 *   GET /api/communities                  -> handleList
 *   GET /api/communities/:slug            -> handleDetail
 *   GET /api/communities/:slug/members    -> handleMembers
 *
 * All three endpoints are public read-only. Writes (Slice 4) will live in
 * a separate module under POST /api/communities/... with NIP-07 auth.
 */

const { handleList } = require('./list.js')
const { handleDetail } = require('./detail.js')
const { handleMembers } = require('./members.js')

module.exports = { handleList, handleDetail, handleMembers }
