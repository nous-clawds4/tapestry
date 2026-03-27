/**
 * Strfry API Module
 * Exports strfry-related operation handlers
 */

const { handleGetFilteredContentStatus } = require('./queries/filteredContent');
const { handleStrfryScan } = require('./queries/scan');
const { handleStrfryScanStream } = require('./queries/scanStream');
const { handleStrfryScanCount } = require('./queries/scanCount');
const { handleToggleStrfryPlugin } = require('./commands/toggle');
const { handlePublishEvent } = require('./commands/publishEvent');

// Export handlers directly - this allows the central router to register endpoints
module.exports = {
    // Queries (read operations)
    handleGetFilteredContentStatus,
    handleStrfryScan,
    handleStrfryScanStream,
    handleStrfryScanCount,
    
    // Commands (write operations)
    handleToggleStrfryPlugin,
    handlePublishEvent
};
