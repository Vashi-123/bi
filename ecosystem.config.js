module.exports = {
  apps: [
    {
      name: 'powerbi-backend',
      script: './venv/bin/python',
      args: '-m uvicorn server:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      env: {
        DATA_PATH: '/home/usman/project_data/processed/final_df/**/*.parquet',
        ADMIN_USER: 'admin',
        ADMIN_PASS: 'giftery2024'
      }
    },
    {
      name: 'powerbi-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://192.168.55.112:8000',
        PORT: 3000
      }
    },
    {
      name: 'powerbi-frontend-dev',
      script: 'npm',
      args: 'run start',
      cwd: '/home/usman/powerbi-dev/frontend',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://192.168.55.112:8000',
        PORT: 3001
      }
    }
  ]
};
