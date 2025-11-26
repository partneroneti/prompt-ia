// In-memory store for custom reports (production would use database)
const customReports = new Map();

/**
 * Create a new custom report definition
 * @param {Object} reportDef - Report definition
 * @returns {string} Report ID
 */
const createCustomReport = (reportDef) => {
    const reportId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    customReports.set(reportId, {
        id: reportId,
        name: reportDef.name,
        description: reportDef.description,
        sqlQuery: reportDef.sqlQuery,
        columns: reportDef.columns || [],
        filters: reportDef.filters || {},
        createdAt: new Date().toISOString(),
        createdBy: reportDef.createdBy || null
    });
    
    return reportId;
};

/**
 * Get a custom report by ID
 * @param {string} reportId - Report ID
 * @returns {Object|null} Report definition or null
 */
const getCustomReport = (reportId) => {
    return customReports.get(reportId) || null;
};

/**
 * Get all custom reports
 * @returns {Array} Array of report definitions
 */
const getAllCustomReports = () => {
    return Array.from(customReports.values());
};

/**
 * Delete a custom report
 * @param {string} reportId - Report ID
 * @returns {boolean} True if deleted, false if not found
 */
const deleteCustomReport = (reportId) => {
    return customReports.delete(reportId);
};

module.exports = {
    createCustomReport,
    getCustomReport,
    getAllCustomReports,
    deleteCustomReport
};

