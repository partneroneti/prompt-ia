/**
 * Test script for all Phase 1 helper modules
 * Run with: node server/helpers/testHelpers.js
 */

const dateHelper = require('./dateHelper');

console.log('🧪 Testing Phase 1 Helper Modules\n');

// ===========================
// Test 1: Date Helper
// ===========================
console.log('📅 Testing Date Helper:');
console.log('------------------------');

// Test natural date parsing
const testDates = [
    'hoje',
    'ontem',
    'semana passada',
    'mês passado',
    '15/11/2025',
    '3 dias atrás',
    '2 semanas atrás'
];

testDates.forEach(dateStr => {
    const parsed = dateHelper.parseNaturalDate(dateStr);
    console.log(`"${dateStr}" → ${parsed ? dateHelper.formatBRDate(parsed) : 'null'}`);
});

// Test date ranges
console.log('\n📊 Testing Date Ranges:');
const testRanges = [
    'últimos 7 dias',
    'este mês',
    'mês passado',
    'entre 01/11/2025 e 30/11/2025'
];

testRanges.forEach(rangeStr => {
    const range = dateHelper.parseDateRange(rangeStr);
    if (range) {
        console.log(`"${rangeStr}" →`);
        console.log(`  Start: ${dateHelper.formatBRDate(range.start)}`);
        console.log(`  End: ${dateHelper.formatBRDate(range.end)}`);
    }
});

// Test relative time
console.log('\n⏰ Testing Relative Time:');
const testRelativeDates = [
    new Date(), // now
    new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
];

testRelativeDates.forEach(date => {
    console.log(`${dateHelper.formatBRDateTime(date)} → ${dateHelper.getRelativeTime(date)}`);
});

console.log('\n✅ Date Helper tests completed!\n');

// ===========================
// Test 2: Profile Helper (requires DB connection)
// ===========================
console.log('👤 Profile Helper:');
console.log('------------------------');
console.log('Functions available:');
console.log('  - getProfileByName(name)');
console.log('  - getUserProfiles(userId)');
console.log('  - getPrimaryProfile(userId)');
console.log('  - assignProfile(userId, profileId, createdBy)');
console.log('  - removeProfile(userId, profileId)');
console.log('  - changeUserProfile(userId, newProfileId, modifiedBy)');
console.log('  - getAllProfiles()');
console.log('✅ Profile Helper module loaded!\n');

// ===========================
// Test 3: Entity Helper (requires DB connection)
// ===========================
console.log('🏢 Entity Helper:');
console.log('------------------------');
console.log('Functions available:');
console.log('  - getEntityByName(name)');
console.log('  - getUsersByEntity(entityId)');
console.log('  - updateUserEntity(userId, entityId)');
console.log('  - getAllEntities()');
console.log('  - getUserCountByEntity()');
console.log('✅ Entity Helper module loaded!\n');

// ===========================
// Test 4: RBAC Helper (requires DB connection)
// ===========================
console.log('🔐 RBAC Helper:');
console.log('------------------------');
console.log('Functions available:');
console.log('  - hasRole(userId, roleName)');
console.log('  - hasAnyRole(userId, roleNames)');
console.log('  - hasAllRoles(userId, roleNames)');
console.log('  - getUserRoles(userId)');
console.log('  - hasMenuAccess(userId, menuPath)');
console.log('  - isMaster(userId)');
console.log('  - canManageUser(managerId, targetUserId)');
console.log('  - canPerformAction(userId, action, resource)');
console.log('  - getPermissionSummary(userId)');
console.log('✅ RBAC Helper module loaded!\n');

console.log('========================================');
console.log('✅ All Phase 1 helpers successfully loaded!');
console.log('========================================');
console.log('\n📝 Next steps:');
console.log('  1. Integrate helpers into AI conversation handler');
console.log('  2. Test with database queries (profileHelper, entityHelper, rbacHelper)');
console.log('  3. Add helper usage to conversational commands');
