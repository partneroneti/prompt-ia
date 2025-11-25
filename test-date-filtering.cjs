/**
 * Comprehensive Test Suite for Date Filtering
 * Tests all date filtering scenarios to identify what's working
 */

const dateHelper = require('./server/helpers/dateHelper');

console.log('🧪 COMPREHENSIVE DATE FILTERING TEST SUITE\n');
console.log('==========================================\n');

// Test 1: Date Parsing
console.log('📅 Test 1: Date Parsing Functions');
console.log('-----------------------------------');

const testCases = [
    'ontem',
    'hoje',
    'amanhã',
    'semana passada',
    'mês passado',
    'últimos 7 dias',
    '3 dias atrás',
    '15/11/2025',
    '2025-11-25'
];

testCases.forEach(testCase => {
    const parsed = dateHelper.parseNaturalDate(testCase);
    console.log(`✓ "${testCase}" → ${parsed ? dateHelper.formatBRDate(parsed) : 'FAILED'}`);
});

console.log('\n📊 Test 2: Date Range Parsing');
console.log('-----------------------------------');

const rangeCases = [
    'últimos 7 dias',
    'esta semana',
    'este mês',
    'mês passado',
    'entre 01/11/2025 e 30/11/2025'
];

rangeCases.forEach(testCase => {
    const range = dateHelper.parseDateRange(testCase);
    if (range) {
        console.log(`✓ "${testCase}"`);
        console.log(`  Start: ${dateHelper.formatBRDate(range.start)}`);
        console.log(`  End: ${dateHelper.formatBRDate(range.end)}`);
    } else {
        console.log(`✗ "${testCase}" → FAILED`);
    }
});

console.log('\n⏰ Test 3: Relative Time');
console.log('-----------------------------------');

const now = new Date();
const testDates = [
    new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
    new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
    new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
    new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
];

testDates.forEach(date => {
    const relative = dateHelper.getRelativeTime(date);
    console.log(`✓ ${dateHelper.formatBRDateTime(date)} → ${relative}`);
});

console.log('\n🔍 Test 4: SQL Query Generation');
console.log('-----------------------------------');

// Simulate what the server does
function simulateQueryGeneration(dateFrom, dateTo) {
    let startDate, endDate;

    if (dateFrom) {
        const range = dateHelper.parseDateRange(dateFrom);
        if (range) {
            startDate = range.start;
            endDate = range.end;
        } else {
            startDate = dateHelper.parseNaturalDate(dateFrom);
            if (startDate) {
                startDate.setHours(0, 0, 0, 0);
            }
        }
    }

    if (dateTo && !endDate) {
        endDate = dateHelper.parseNaturalDate(dateTo);
        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }
    }

    if (startDate && endDate) {
        console.log(`✓ WHERE dh_edita BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`);
        console.log(`  Range: ${dateHelper.formatBRDate(startDate)} to ${dateHelper.formatBRDate(endDate)}`);
        return true;
    } else if (startDate) {
        console.log(`✓ WHERE dh_edita >= '${startDate.toISOString()}'`);
        console.log(`  From: ${dateHelper.formatBRDate(startDate)}`);
        return true;
    } else {
        console.log(`✗ FAILED to generate query`);
        return false;
    }
}

console.log('\nTest: "ontem"');
simulateQueryGeneration('ontem', 'ontem');

console.log('\nTest: "últimos 7 dias"');
simulateQueryGeneration('últimos 7 dias', null);

console.log('\nTest: "entre 01/11/2025 e 30/11/2025"');
simulateQueryGeneration('entre 01/11/2025 e 30/11/2025', null);

console.log('\n==========================================');
console.log('✅ All date helper tests completed');
console.log('==========================================\n');

console.log('📝 Next steps:');
console.log('1. Check server logs for actual AI requests');
console.log('2. Verify OpenAI is sending date_from/date_to');
console.log('3. Test via frontend to see complete flow');
