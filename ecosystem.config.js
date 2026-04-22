module.exports = {
  apps: [
    {
      name: 'powerbi-backend',
      script: 'backend/server.py',
      cwd: './',
      interpreter: './venv/bin/python',
      env: {
        DATA_PATH: '/home/usman/project_data/processed/final_df/**/*.parquet'
      },
      watch: ['backend'],
      autorestart: true
    },
    {
      name: 'powerbi-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://192.168.55.112:8000'
      },
      autorestart: true
    }
  ]
};
