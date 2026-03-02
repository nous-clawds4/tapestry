/**
 * Strfry API Module
 * Exports strfry-related operation handlers
 */

const { handleGetFilteredContentStatus } = require('./queries/filteredContent');
const { handleStrfryScan } = require('./queries/scan');
const { handleToggleStrfryPlugin } = require('./commands/toggle');
const { handlePublishEvent } = require('./commands/publishEvent');

// Export handlers directly - this allows the central router to register endpoints
module.exports = {
    // Queries (read operations)
    handleGetFilteredContentStatus,
    handleStrfryScan,
    
    // Commands (write operations)
    handleToggleStrfryPlugin,
    handlePublishEvent
};
