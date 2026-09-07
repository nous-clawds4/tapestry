/**
 * DLists API Module
 * Simple Lists (kind 9998/39998 headers, kind 9999/39999 items) read endpoints.
 */

const { handleListItemCounts, createTally } = require('./itemCounts');

module.exports = {
    handleListItemCounts,
    createTally,
};
