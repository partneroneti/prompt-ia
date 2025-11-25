/**
 * Date Helper Functions
 * Parses natural language date/time expressions for Portuguese BR
 */

/**
 * Parse natural language dates (Portuguese)
 * Examples: "hoje", "ontem", "semana passada", "último mês", "15/11/2025"
 * @param {string} dateString - Natural language date string
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseNaturalDate(dateString) {
    if (!dateString) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalized = dateString.toLowerCase().trim();

    // Hoje (Today)
    if (normalized === 'hoje' || normalized === 'today') {
        return today;
    }

    // Ontem (Yesterday)
    if (normalized === 'ontem' || normalized === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    }

    // Amanhã (Tomorrow)
    if (normalized === 'amanhã' || normalized === 'amanha' || normalized === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }

    // Semana passada (Last week)
    if (normalized.includes('semana passada') || normalized.includes('last week')) {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return lastWeek;
    }

    // Mês passado / último mês (Last month)
    if (normalized.includes('mês passado') || normalized.includes('mes passado') ||
        normalized.includes('último mês') || normalized.includes('ultimo mes') ||
        normalized.includes('last month')) {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return lastMonth;
    }

    // Ano passado (Last year)
    if (normalized.includes('ano passado') || normalized.includes('last year')) {
        const lastYear = new Date(today);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        return lastYear;
    }

    // N dias atrás (N days ago)
    const daysAgoMatch = normalized.match(/(\d+)\s*(dia|dias|day|days)\s*(atrás|atras|ago)/);
    if (daysAgoMatch) {
        const days = parseInt(daysAgoMatch[1]);
        const daysAgo = new Date(today);
        daysAgo.setDate(daysAgo.getDate() - days);
        return daysAgo;
    }

    // N semanas atrás (N weeks ago)
    const weeksAgoMatch = normalized.match(/(\d+)\s*(semana|semanas|week|weeks)\s*(atrás|atras|ago)/);
    if (weeksAgoMatch) {
        const weeks = parseInt(weeksAgoMatch[1]);
        const weeksAgo = new Date(today);
        weeksAgo.setDate(weeksAgo.getDate() - (weeks * 7));
        return weeksAgo;
    }

    // N meses atrás (N months ago)
    const monthsAgoMatch = normalized.match(/(\d+)\s*(mês|mes|meses|month|months)\s*(atrás|atras|ago)/);
    if (monthsAgoMatch) {
        const months = parseInt(monthsAgoMatch[1]);
        const monthsAgo = new Date(today);
        monthsAgo.setMonth(monthsAgo.getMonth() - months);
        return monthsAgo;
    }

    // Try parsing Brazilian date format (DD/MM/YYYY)
    const brDateMatch = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brDateMatch) {
        const day = parseInt(brDateMatch[1]);
        const month = parseInt(brDateMatch[2]) - 1; // JS months are 0-indexed
        const year = parseInt(brDateMatch[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Try parsing ISO format (YYYY-MM-DD)
    const isoDateMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Try standard Date parsing as last resort
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
    }

    return null;
}

/**
 * Parse date range from natural language
 * Examples: "últimos 7 dias", "mês passado", "entre 01/11 e 30/11"
 * @param {string} rangeString - Natural language date range
 * @returns {Object|null} {start: Date, end: Date} or null
 */
function parseDateRange(rangeString) {
    if (!rangeString) return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const normalized = rangeString.toLowerCase().trim();

    // Últimos N dias (Last N days)
    const lastDaysMatch = normalized.match(/últimos?\s*(\d+)\s*dias?|last\s*(\d+)\s*days?/);
    if (lastDaysMatch) {
        const days = parseInt(lastDaysMatch[1] || lastDaysMatch[2]);
        const start = new Date(today);
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        return { start, end: today };
    }

    // Esta semana (This week)
    if (normalized.includes('esta semana') || normalized.includes('this week')) {
        const start = new Date(today);
        start.setDate(start.getDate() - start.getDay()); // Sunday
        start.setHours(0, 0, 0, 0);
        return { start, end: today };
    }

    // Este mês (This month)
    if (normalized.includes('este mês') || normalized.includes('este mes') || normalized.includes('this month')) {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        return { start, end: today };
    }

    // Mês passado (Last month)
    if (normalized.includes('mês passado') || normalized.includes('mes passado') || normalized.includes('last month')) {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    // Este ano (This year) - múltiplas variações
    if (normalized.includes('este ano') || normalized.includes('esse ano') ||
        normalized.includes('neste ano') || normalized.includes('nesse ano') ||
        normalized.includes('this year')) {
        const start = new Date(today.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        return { start, end: today };
    }

    // Specific month with year (e.g., "setembro de 2025", "maio de 2025")
    const monthYearMatch = rangeString.match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\\s+de\\s+(\\d{4})/i);
    if (monthYearMatch) {
        const months = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2,
            'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6,
            'agosto': 7, 'setembro': 8, 'outubro': 9,
            'novembro': 10, 'dezembro': 11
        };
        const monthName = monthYearMatch[1].toLowerCase();
        const year = parseInt(monthYearMatch[2]);
        const monthIndex = months[monthName];

        const start = new Date(year, monthIndex, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0); // Last day of month
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    // Specific month only (assumes current year)
    const monthOnlyMatch = rangeString.match(/^(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)$/i);
    if (monthOnlyMatch) {
        const months = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2,
            'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6,
            'agosto': 7, 'setembro': 8, 'outubro': 9,
            'novembro': 10, 'dezembro': 11
        };
        const monthName = monthOnlyMatch[1].toLowerCase();
        const monthIndex = months[monthName];

        const start = new Date(today.getFullYear(), monthIndex, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today.getFullYear(), monthIndex + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    // Entre X e Y (Between X and Y)
    const betweenMatch = rangeString.match(/entre\s+(.+?)\s+e\s+(.+)|between\s+(.+?)\s+and\s+(.+)/i);
    if (betweenMatch) {
        const startStr = betweenMatch[1] || betweenMatch[3];
        const endStr = betweenMatch[2] || betweenMatch[4];
        const start = parseNaturalDate(startStr.trim());
        const end = parseNaturalDate(endStr.trim());

        if (start && end) {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
    }

    return null;
}

/**
 * Format date to Brazilian format (DD/MM/YYYY)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatBRDate(date) {
    if (!date || !(date instanceof Date)) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

/**
 * Format date to Brazilian datetime format (DD/MM/YYYY HH:mm)
 * @param {Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
function formatBRDateTime(date) {
    if (!date || !(date instanceof Date)) return '';

    const dateStr = formatBRDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Convert date to PostgreSQL format (YYYY-MM-DD)
 * @param {Date} date - Date to convert
 * @returns {string} PostgreSQL date string
 */
function toPostgresDate(date) {
    if (!date || !(date instanceof Date)) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Get relative time description (Portuguese)
 * @param {Date} date - Date to describe
 * @returns {string} Relative time description
 */
function getRelativeTime(date) {
    if (!date || !(date instanceof Date)) return '';

    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
    if (diffDays < 365) return `há ${Math.floor(diffDays / 30)} mês${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
    return `há ${Math.floor(diffDays / 365)} ano${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
}

module.exports = {
    parseNaturalDate,
    parseDateRange,
    formatBRDate,
    formatBRDateTime,
    toPostgresDate,
    getRelativeTime
};
