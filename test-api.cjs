#!/usr/bin/env node

/**
 * Direct API Test - bypassing AI to test server directly
 */

const http = require('http');

console.log('🧪 TESTING SERVER API DIRECTLY\n');
console.log('==========================================\n');

// Test 1: Query users with date filter directly
const testQuery1 = {
    message: "Liste usuários modificados ontem"
};

const testQuery2 = {
    message: "Mostre alterações dos últimos 7 dias"
};

const testQuery3 = {
    message: "Usuários editados hoje"
};

function testAPI(query, testName) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(query);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                console.log(`\n📝 ${testName}`);
                console.log('Request:', query.message);
                console.log('Status:', res.statusCode);
                try {
                    const parsed = JSON.parse(responseData);
                    console.log('Response:', JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('Response:', responseData);
                }
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error(`Error in ${testName}:`, error);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function runTests() {
    try {
        await testAPI(testQuery1, 'Test 1: "Lista usuários modificados ontem"');
        await new Promise(r => setTimeout(r, 1000));

        await testAPI(testQuery2, 'Test 2: "Mostre alterações dos últimos 7 dias"');
        await new Promise(r => setTimeout(r, 1000));

        await testAPI(testQuery3, 'Test 3: "Usuários editados hoje"');

        console.log('\n==========================================');
        console.log('✅ API tests completed');
        console.log('==========================================\n');

        console.log('📊 Analysis:');
        console.log('- Check if AI is calling queryUsers with date filters');
        console.log('- Look for date_from and date_to in the tool arguments');
        console.log('- Verify server is parsing dates correctly');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests();
