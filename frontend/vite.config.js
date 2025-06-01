import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from the root .env file
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  
  // Only expose specific environment variables to the client
  const clientEnv = {
    'process.env.REACT_APP_WS_SERVER_URL': JSON.stringify(env.REACT_APP_WS_SERVER_URL || 'ws://localhost:8002'),
    'process.env.REACT_APP_API_URL': JSON.stringify(env.REACT_APP_API_URL || 'http://localhost:8002'),
    'process.env.REACT_APP_DEFAULT_MODEL': JSON.stringify(env.REACT_APP_DEFAULT_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free'),
    'process.env.REACT_APP_OPENROUTER_API_KEY': JSON.stringify(env.REACT_APP_OPENROUTER_API_KEY || ''),
    'process.env.REACT_APP_OPENROUTER_MODEL_NAME': JSON.stringify(env.REACT_APP_OPENROUTER_MODEL_NAME || 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free')
  };

  return {
    plugins: [react()],
    define: clientEnv,
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8002',
          changeOrigin: true,
          secure: false,
          ws: true
        },
        '/socket.io': {
          target: 'ws://localhost:8002',
          ws: true
        }
      },
      cors: {
        origin: 'http://localhost:3000',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true
      }
    }
  };
});
