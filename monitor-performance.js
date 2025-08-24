const os = require("os");
const { exec } = require("child_process");

// Performance monitoring for every-second casino cron jobs
function monitorPerformance() {
  console.log("📊 Performance Monitor for Casino Cron Jobs");
  console.log("==========================================\n");

  let iteration = 0;
  const maxIterations = 60; // Monitor for 1 minute

  const interval = setInterval(() => {
    iteration++;

    // Get system metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = ((usedMem / totalMem) * 100).toFixed(2);

    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;

    console.log(
      `⏱️  Iteration ${iteration}/${maxIterations} - ${new Date().toLocaleTimeString()}`
    );
    console.log(
      `💾 Memory Usage: ${memoryUsage}% (${(
        usedMem /
        1024 /
        1024 /
        1024
      ).toFixed(2)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB)`
    );
    console.log(
      `🖥️  CPU Load: ${loadAvg[0].toFixed(2)} (1min) | ${loadAvg[1].toFixed(
        2
      )} (5min) | ${loadAvg[2].toFixed(2)} (15min)`
    );
    console.log(`🔢 CPU Cores: ${cpuCount}`);

    // Check if processes are running
    exec(
      'ps aux | grep -E "(cron-service|server)" | grep -v grep',
      (error, stdout) => {
        if (error) {
          console.log("❌ Error checking processes:", error.message);
        } else {
          const processes = stdout
            .trim()
            .split("\n")
            .filter((line) => line.length > 0);
          console.log(`🔄 Running Processes: ${processes.length}`);
          processes.forEach((proc) => {
            const parts = proc.split(/\s+/);
            const pid = parts[1];
            const cpu = parts[2];
            const mem = parts[3];
            const cmd = parts.slice(10).join(" ");
            console.log(
              `   PID: ${pid} | CPU: ${cpu}% | MEM: ${mem}% | ${cmd.substring(
                0,
                50
              )}...`
            );
          });
        }
      }
    );

    console.log("---");

    // Stop monitoring after max iterations
    if (iteration >= maxIterations) {
      clearInterval(interval);
      console.log("✅ Performance monitoring completed");
      console.log("\n📈 Recommendations:");
      console.log("   - If memory usage > 80%: Consider increasing interval");
      console.log("   - If CPU load > 2.0: Consider reducing batch size");
      console.log("   - If processes are missing: Check service logs");
      console.log(
        "   - To change interval: Set CASINO_CRON_INTERVAL environment variable"
      );
    }
  }, 1000); // Check every second
}

// Run the monitor
monitorPerformance();
