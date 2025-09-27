#!/usr/bin/env node

/**
 * Simple script to test connection to conductor-gateway
 * This tests both the health endpoint and the stream-execute endpoint
 */

const GATEWAY_URL = 'http://localhost:5006';
const API_KEY = 'test-api-key-123';

async function testConnection() {
    console.log('🔍 Testing connection to Conductor Gateway...\n');

    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    try {
        const healthResponse = await fetch(`${GATEWAY_URL}/health`, {
            method: 'GET',
            headers: {
                'X-API-Key': API_KEY,
            },
        });

        if (healthResponse.ok) {
            console.log('✅ Health endpoint is accessible');
            const healthData = await healthResponse.text();
            console.log('📋 Health response:', healthData);
        } else {
            console.log('❌ Health endpoint failed:', healthResponse.status, healthResponse.statusText);
        }
    } catch (error) {
        console.log('❌ Health endpoint error:', error.message);
    }

    console.log('');

    // Test 2: Stream execute endpoint
    console.log('2️⃣ Testing stream-execute endpoint...');
    try {
        const payload = {
            uid: 'test-' + Date.now(),
            title: "Connection Test",
            textEntries: [{
                uid: "1",
                content: "Test connection to conductor gateway"
            }],
            targetType: "conductor",
            isTemplate: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        console.log('📤 Sending test payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(`${GATEWAY_URL}/api/v1/stream-execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Stream-execute endpoint is accessible');
            console.log('📋 Response:', JSON.stringify(data, null, 2));

            if (data.job_id) {
                console.log('\n3️⃣ Testing SSE stream...');
                testSSEConnection(data.job_id);
            }
        } else {
            const errorText = await response.text();
            console.log('❌ Stream-execute endpoint failed:', response.status, response.statusText);
            console.log('📋 Error response:', errorText);
        }
    } catch (error) {
        console.log('❌ Stream-execute endpoint error:', error.message);
    }
}

function testSSEConnection(jobId) {
    return new Promise((resolve) => {
        const streamUrl = `${GATEWAY_URL}/api/v1/stream/${jobId}`;
        console.log('🔄 Connecting to SSE stream:', streamUrl);

        const eventSource = new (require('eventsource'))(streamUrl);
        let messageCount = 0;
        const timeout = setTimeout(() => {
            eventSource.close();
            console.log('⏰ SSE test timeout after 10 seconds');
            resolve();
        }, 10000);

        eventSource.onopen = () => {
            console.log('✅ SSE connection opened');
        };

        eventSource.onmessage = (event) => {
            messageCount++;
            console.log(`📨 SSE Message ${messageCount}:`, event.data);

            try {
                const data = JSON.parse(event.data);
                if (data.event === 'result' || data.event === 'error') {
                    clearTimeout(timeout);
                    eventSource.close();
                    console.log('✅ SSE stream completed');
                    resolve();
                }
            } catch (e) {
                console.log('⚠️ Could not parse SSE data as JSON');
            }
        };

        eventSource.onerror = (error) => {
            console.log('❌ SSE connection error:', error);
            clearTimeout(timeout);
            eventSource.close();
            resolve();
        };
    });
}

// Check if eventsource is available
try {
    require('eventsource');
} catch (e) {
    console.log('⚠️ Installing eventsource dependency...');
    const { execSync } = require('child_process');
    try {
        execSync('npm install eventsource', { stdio: 'inherit' });
        console.log('✅ eventsource installed');
    } catch (installError) {
        console.log('❌ Could not install eventsource. SSE test will be skipped.');
    }
}

// Run the test
if (require.main === module) {
    testConnection().then(() => {
        console.log('\n🏁 Connection test completed');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testConnection };