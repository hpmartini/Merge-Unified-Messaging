import http from 'http';

const NUM_REQUESTS = 100;
const CONCURRENCY = 10;
const PORT = 3044;

async function runTest() {
  console.log(`Running latency test against http://localhost:${PORT}/api/ai/health`);
  console.log(`Requests: ${NUM_REQUESTS}, Concurrency: ${CONCURRENCY}`);

  const latencies = [];
  let completed = 0;
  
  const makeRequest = () => {
    return new Promise((resolve) => {
      const start = performance.now();
      http.get(`http://localhost:${PORT}/api/ai/health`, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const end = performance.now();
          latencies.push(end - start);
          completed++;
          resolve();
        });
      }).on('error', (err) => {
        console.error('Request error:', err.message);
        resolve(); // Continue even on error
      });
    });
  };

  const startTime = performance.now();
  
  for (let i = 0; i < NUM_REQUESTS; i += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, NUM_REQUESTS - i);
    const promises = Array(batchSize).fill(0).map(() => makeRequest());
    await Promise.all(promises);
  }
  
  const endTime = performance.now();
  
  latencies.sort((a, b) => a - b);
  
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p90 = latencies[Math.floor(latencies.length * 0.90)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  
  console.log('\n--- Latency Report ---');
  console.log(`Total Time : ${(endTime - startTime).toFixed(2)} ms`);
  console.log(`Min        : ${min.toFixed(2)} ms`);
  console.log(`Max        : ${max.toFixed(2)} ms`);
  console.log(`Average    : ${avg.toFixed(2)} ms`);
  console.log(`p50        : ${p50.toFixed(2)} ms`);
  console.log(`p90        : ${p90.toFixed(2)} ms`);
  console.log(`p95        : ${p95.toFixed(2)} ms`);
  console.log(`p99        : ${p99.toFixed(2)} ms`);
  
  if (p95 < 200) {
    console.log('\nSUCCESS: p95 latency is under 200ms!');
    process.exit(0);
  } else {
    console.log('\nFAILURE: p95 latency exceeds 200ms!');
    process.exit(1);
  }
}

// Give server a moment to start, then run
setTimeout(runTest, 1000);
