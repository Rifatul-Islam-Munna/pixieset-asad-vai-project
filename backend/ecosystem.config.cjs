module.exports = {
  apps: [
    {
      name: "gallerista-backend",
      script: "dist/main.js",
      // A single process keeps native image memory and background work bounded.
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: process.env.BACKEND_MAX_MEMORY_RESTART || "1200M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
      node_args: "--max-old-space-size=768",
      env: {
        NODE_ENV: "production",
        MALLOC_ARENA_MAX: "2",
      },
    },
  ],
};
