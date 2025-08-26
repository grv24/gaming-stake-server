const { performance } = require('perf_hooks');

// Database load test configuration
const DB_CONFIG = {
  OPERATIONS: 10000,
  BATCH_SIZE: 100,
  CONCURRENT_BATCHES: 10,
  OPERATION_TYPES: ['read', 'write', 'update', 'delete', 'complex_query']
};

// Database statistics
const dbStats = {
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  responseTimes: [],
  operationTypes: {
    read: { count: 0, totalTime: 0, avgTime: 0 },
    write: { count: 0, totalTime: 0, avgTime: 0 },
    update: { count: 0, totalTime: 0, avgTime: 0 },
    delete: { count: 0, totalTime: 0, avgTime: 0 },
    complex_query: { count: 0, totalTime: 0, avgTime: 0 }
  },
  startTime: null,
  endTime: null
};

// Simulate database operation
async function simulateDbOperation(operationType, operationIndex) {
  const startTime = performance.now();
  
  try {
    // Simulate different database operations with realistic delays
    let delay;
    
    switch (operationType) {
      case 'read':
        delay = Math.random() * 5 + 1; // 1-6ms for reads
        break;
      case 'write':
        delay = Math.random() * 10 + 5; // 5-15ms for writes
        break;
      case 'update':
        delay = Math.random() * 8 + 3; // 3-11ms for updates
        break;
      case 'delete':
        delay = Math.random() * 6 + 2; // 2-8ms for deletes
        break;
      case 'complex_query':
        delay = Math.random() * 20 + 10; // 10-30ms for complex queries
        break;
      default:
        delay = Math.random() * 10 + 5;
    }
    
    // Simulate occasional database errors (1% error rate)
    if (Math.random() < 0.01) {
      throw new Error('Database connection timeout');
    }
    
    // Simulate the operation delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    // Update statistics
    dbStats.successfulOperations++;
    dbStats.responseTimes.push(responseTime);
    dbStats.operationTypes[operationType].count++;
    dbStats.operationTypes[operationType].totalTime += responseTime;
    
    return { success: true, responseTime, operationType };
    
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    dbStats.failedOperations++;
    dbStats.responseTimes.push(responseTime);
    
    return { success: false, error: error.message, responseTime, operationType };
  }
}

// Run a batch of database operations
async function runBatch(batchIndex) {
  const batchOperations = [];
  
  for (let i = 0; i < DB_CONFIG.BATCH_SIZE; i++) {
    const operationType = DB_CONFIG.OPERATION_TYPES[Math.floor(Math.random() * DB_CONFIG.OPERATION_TYPES.length)];
    const operationIndex = batchIndex * DB_CONFIG.BATCH_SIZE + i;
    
    batchOperations.push(simulateDbOperation(operationType, operationIndex));
  }
  
  const results = await Promise.all(batchOperations);
  
  // Log batch progress
  const successfulInBatch = results.filter(r => r.success).length;
  const avgTimeInBatch = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`   📦 Batch ${batchIndex + 1}: ${successfulInBatch}/${DB_CONFIG.BATCH_SIZE} successful, avg: ${avgTimeInBatch.toFixed(2)}ms`);
  
  return results;
}

// Run concurrent database load test
async function runDatabaseLoadTest() {
  console.log('🗄️  Starting Database Load Test...');
  console.log(`📊 Configuration:`);
  console.log(`   - Total Operations: ${DB_CONFIG.OPERATIONS}`);
  console.log(`   - Batch Size: ${DB_CONFIG.BATCH_SIZE}`);
  console.log(`   - Concurrent Batches: ${DB_CONFIG.CONCURRENT_BATCHES}`);
  console.log(`   - Operation Types: ${DB_CONFIG.OPERATION_TYPES.join(', ')}`);
  console.log('');
  
  dbStats.startTime = performance.now();
  
  const totalBatches = Math.ceil(DB_CONFIG.OPERATIONS / DB_CONFIG.BATCH_SIZE);
  const batchPromises = [];
  
  // Run batches in groups to control concurrency
  for (let i = 0; i < totalBatches; i += DB_CONFIG.CONCURRENT_BATCHES) {
    const currentBatchGroup = [];
    
    for (let j = 0; j < DB_CONFIG.CONCURRENT_BATCHES && (i + j) < totalBatches; j++) {
      currentBatchGroup.push(runBatch(i + j));
    }
    
    const batchResults = await Promise.all(currentBatchGroup);
    batchPromises.push(...batchResults);
    
    // Small delay between batch groups
    if (i + DB_CONFIG.CONCURRENT_BATCHES < totalBatches) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  dbStats.endTime = performance.now();
  
  // Calculate final statistics
  calculateDbStatistics();
  displayDbResults();
}

// Calculate database statistics
function calculateDbStatistics() {
  // Calculate average times for each operation type
  Object.keys(dbStats.operationTypes).forEach(type => {
    if (dbStats.operationTypes[type].count > 0) {
      dbStats.operationTypes[type].avgTime = dbStats.operationTypes[type].totalTime / dbStats.operationTypes[type].count;
    }
  });
  
  dbStats.totalOperations = dbStats.successfulOperations + dbStats.failedOperations;
}

// Display database test results
function displayDbResults() {
  const totalTime = dbStats.endTime - dbStats.startTime;
  const avgResponseTime = dbStats.responseTimes.reduce((a, b) => a + b, 0) / dbStats.responseTimes.length;
  const minResponseTime = Math.min(...dbStats.responseTimes);
  const maxResponseTime = Math.max(...dbStats.responseTimes);
  const successRate = (dbStats.successfulOperations / dbStats.totalOperations) * 100;
  const operationsPerSecond = dbStats.totalOperations / (totalTime / 1000);
  
  console.log('\n' + '='.repeat(60));
  console.log('🗄️  DATABASE LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Total Test Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`📊 Total Operations: ${dbStats.totalOperations}`);
  console.log(`✅ Successful Operations: ${dbStats.successfulOperations}`);
  console.log(`❌ Failed Operations: ${dbStats.failedOperations}`);
  console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`🚀 Operations/Second: ${operationsPerSecond.toFixed(2)}`);
  console.log('');
  console.log('⏱️  Overall Response Times:');
  console.log(`   - Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   - Minimum: ${minResponseTime.toFixed(2)}ms`);
  console.log(`   - Maximum: ${maxResponseTime.toFixed(2)}ms`);
  console.log(`   - 95th Percentile: ${calculatePercentile(95).toFixed(2)}ms`);
  console.log(`   - 99th Percentile: ${calculatePercentile(99).toFixed(2)}ms`);
  console.log('');
  console.log('📊 Performance by Operation Type:');
  
  Object.entries(dbStats.operationTypes).forEach(([type, stats]) => {
    if (stats.count > 0) {
      console.log(`   - ${type.toUpperCase()}:`);
      console.log(`     Count: ${stats.count}`);
      console.log(`     Average Time: ${stats.avgTime.toFixed(2)}ms`);
      console.log(`     Total Time: ${stats.totalTime.toFixed(2)}ms`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
}

// Calculate percentile
function calculatePercentile(percentile) {
  const sorted = [...dbStats.responseTimes].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Memory usage test
function testMemoryUsage() {
  console.log('\n🧠 Memory Usage Test...');
  
  const memUsage = process.memoryUsage();
  console.log(`   - RSS (Resident Set Size): ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
  
  const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  console.log(`   - Heap Usage: ${heapUsagePercent.toFixed(2)}%`);
}

// Connection pool simulation
async function testConnectionPool() {
  console.log('\n🔗 Connection Pool Test...');
  
  const poolStats = {
    totalConnections: 0,
    activeConnections: 0,
    maxConnections: 20,
    connectionTimes: []
  };
  
  // Simulate connection pool usage
  for (let i = 0; i < 100; i++) {
    const startTime = performance.now();
    
    // Simulate getting connection from pool
    if (poolStats.activeConnections < poolStats.maxConnections) {
      poolStats.activeConnections++;
      poolStats.totalConnections++;
      
      // Simulate connection usage time
      const usageTime = Math.random() * 100 + 50; // 50-150ms
      await new Promise(resolve => setTimeout(resolve, usageTime));
      
      // Release connection back to pool
      poolStats.activeConnections--;
      
      const endTime = performance.now();
      const connectionTime = endTime - startTime;
      poolStats.connectionTimes.push(connectionTime);
      
      if (i % 20 === 0) {
        console.log(`   🔗 Connection ${i + 1}: ${connectionTime.toFixed(2)}ms (Active: ${poolStats.activeConnections}/${poolStats.maxConnections})`);
      }
    } else {
      // Pool is full, wait for connection
      await new Promise(resolve => setTimeout(resolve, 10));
      i--; // Retry this iteration
    }
  }
  
  const avgConnectionTime = poolStats.connectionTimes.reduce((a, b) => a + b, 0) / poolStats.connectionTimes.length;
  console.log(`\n🔗 Connection Pool Results:`);
  console.log(`   - Total Connections: ${poolStats.totalConnections}`);
  console.log(`   - Average Connection Time: ${avgConnectionTime.toFixed(2)}ms`);
  console.log(`   - Max Pool Size: ${poolStats.maxConnections}`);
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Database Load Testing Suite...\n');
    
    // Run database load test
    await runDatabaseLoadTest();
    
    // Test memory usage
    testMemoryUsage();
    
    // Test connection pool
    await testConnectionPool();
    
    console.log('\n✅ Database load testing completed!');
    
  } catch (error) {
    console.error('❌ Error during database load test:', error.message);
  }
}

// Run the database load test
main();
