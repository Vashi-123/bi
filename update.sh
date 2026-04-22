#!/bin/bash

# Giftybox Dashboard Update Script
echo "--- Starting Giftybox Analytics Update ---"

# 1. Update Frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 2. Restart PM2 Processes
echo "Reloading services..."
pm2 reload ecosystem.config.js

echo "--- Update Complete! ---"
echo "Check logs with: pm2 logs"
