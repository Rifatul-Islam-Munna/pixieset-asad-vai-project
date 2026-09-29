module.exports = {
  apps: [
    {
      name: "gallerista-backend",
      script: "dist/main.js",
      exec_mode: "cluster",
      instances: Math.max(
        1,
        Math.min(3, Number(process.env.BACKEND_WEB_CONCURRENCY || 3) || 3),
      ),
      autorestart: true,
      max_memory_restart: process.env.BACKEND_MAX_MEMORY_RESTART || "1200M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
