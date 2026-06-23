export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'mathv2-super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  upload: {
    destination: process.env.UPLOAD_DESTINATION || './uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'image/tiff',
      // DXF / DWG come through as octet-stream or application/acad
      'application/octet-stream',
      'application/acad',
      'application/x-acad',
      'application/autocad_dwg',
      'image/x-dwg',
      'application/dwg',
      'application/x-dwg',
      'application/x-autocad',
      'image/vnd.dwg',
    ],
  },

  aiEngine: {
    url: process.env.AI_ENGINE_URL || 'http://localhost:8000',
    apiKey: process.env.AI_ENGINE_API_KEY || '',
    timeoutMs: parseInt(process.env.AI_ENGINE_TIMEOUT_MS, 10) || 120_000,
  },

  gcodeEngine: {
    url: process.env.GCODE_ENGINE_URL || 'http://localhost:8001',
    apiKey: process.env.GCODE_ENGINE_API_KEY || '',
    timeoutMs: parseInt(process.env.GCODE_ENGINE_TIMEOUT_MS, 10) || 60_000,
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:5173').split(','),
  },
});
