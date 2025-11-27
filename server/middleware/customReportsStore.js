// In-memory store for custom reports (production would use database)
const customReports = new Map();
const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '../data/customReports.json');

// Carregar relatórios do arquivo ao iniciar
const loadReports = () => {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            const reports = JSON.parse(data);
            reports.forEach(report => {
                customReports.set(report.id, report);
            });
            console.log(`[CustomReports] Carregados ${customReports.size} relatórios customizados do arquivo`);
        }
    } catch (error) {
        console.error('[CustomReports] Erro ao carregar relatórios:', error);
    }
};

// Salvar relatórios no arquivo
const saveReports = () => {
    try {
        const dir = path.dirname(STORAGE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const reports = Array.from(customReports.values());
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(reports, null, 2), 'utf8');
    } catch (error) {
        console.error('[CustomReports] Erro ao salvar relatórios:', error);
    }
};

// Carregar ao iniciar
loadReports();

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
    
    // Salvar no arquivo
    saveReports();
    
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
    const deleted = customReports.delete(reportId);
    if (deleted) {
        saveReports();
    }
    return deleted;
};

module.exports = {
    createCustomReport,
    getCustomReport,
    getAllCustomReports,
    deleteCustomReport
};

