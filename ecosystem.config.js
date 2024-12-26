module.exports = {
  apps: [{
    name: 'botuzap',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3333
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3333
    }
  }]
};
