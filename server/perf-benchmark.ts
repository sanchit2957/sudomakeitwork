import { appRouter } from "./routers";

async function runBenchmark() {
  const formatBytes = (b: number) => (b / 1024 / 1024).toFixed(2) + " MB";
  const startMem = process.memoryUsage();

  console.log("=== BASELINE MEMORY ===");
  console.log("RSS: " + formatBytes(startMem.rss));
  console.log("Heap Total: " + formatBytes(startMem.heapTotal));
  console.log("Heap Used: " + formatBytes(startMem.heapUsed));
  console.log("External: " + formatBytes(startMem.external));

  // Simulate mock context
  const mockContext = {
    user: null,
    req: { protocol: "http", headers: {}, cookies: {} } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
  };
  const caller = appRouter.createCaller(mockContext);

  const concurrencyLevels = [5, 10, 25, 50];
  console.log("\n=== CONCURRENCY BENCHMARK ===");

  for (const concurrency of concurrencyLevels) {
    const startTime = Date.now();
    const tasks = Array.from({ length: concurrency }).map(async (_, idx) => {
      const t0 = Date.now();
      const conditions = await caller.rescue.emergency.conditions({});
      const health = await caller.system.health({ timestamp: Date.now() });
      const dt = Date.now() - t0;
      return { idx, dt, ok: Boolean(conditions) && health.ok };
    });

    const results = await Promise.all(tasks);
    const totalTime = Date.now() - startTime;
    const avgLatency = (results.reduce((acc, r) => acc + r.dt, 0) / results.length).toFixed(2);
    const successful = results.filter((r) => r.ok).length;

    console.log(
      `Concurrency: ${concurrency} | Total Time: ${totalTime}ms | Avg Latency: ${avgLatency}ms | Success: ${successful}/${concurrency}`
    );
  }

  const endMem = process.memoryUsage();
  console.log("\n=== POST-BENCHMARK MEMORY ===");
  console.log("RSS: " + formatBytes(endMem.rss));
  console.log("Heap Used: " + formatBytes(endMem.heapUsed));
  console.log("Delta Heap: " + formatBytes(endMem.heapUsed - startMem.heapUsed));
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
