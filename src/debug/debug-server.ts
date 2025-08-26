import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CasinoData {
  casinoType: string;
  hasCurrent: boolean;
  hasResults: boolean;
  currentSize: number;
  resultsSize: number;
  lastRedisUpdate: Date | null;
  lastSocketUpdate: Date | null;
  redisData?: any;
  socketData?: any;
  status: 'active' | 'inactive' | 'error';
}

interface CasinoDebugData {
  redisData: Map<string, CasinoData>;
  socketData: Map<string, CasinoData>;
  totalCasinos: number;
  activeCasinos: number;
  inactiveCasinos: number;
  errors: number;
  lastUpdate: Date;
  redisConnected: boolean;
  redisStatus: string;
}

class CasinoDebugServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private redis: Redis;
  private casinoData: CasinoDebugData;
  private casinoTypes: string[];

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`🔗 Connecting to Redis: ${redisUrl}`);
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });

    // Handle Redis connection errors gracefully
    this.redis.on('error', (err) => {
      console.log(`⚠️  Redis connection error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('ready', () => {
      console.log('✅ Redis is ready');
    });

    this.casinoTypes = [
      'dt6', 'teen', 'poker', 'teen20', 'teen9', 'teen8', 'poker20', 'poker6', 'card32eu', 'war',
      'lucky5', 'joker20', 'joker1', 'ab4', 'lottcard',
      'aaa', 'abj', 'dt20', 'lucky7eu', 'dt202', 'teenmuf', 'teen20c', 'btable2', 'goal', 'baccarat2'
    ];

    this.casinoData = {
      redisData: new Map(),
      socketData: new Map(),
      totalCasinos: 0,
      activeCasinos: 0,
      inactiveCasinos: 0,
      errors: 0,
      lastUpdate: new Date(),
      redisConnected: false,
      redisStatus: 'disconnected'
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.initializeCasinoData();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        redis: this.redis.status,
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: this.io.engine.clientsCount
      });
    });

    // Get all casino debug data
    this.app.get('/api/casino-debug', (req, res) => {
      const response = {
        ...this.casinoData,
        redisData: Object.fromEntries(this.casinoData.redisData),
        socketData: Object.fromEntries(this.casinoData.socketData)
      };
      res.json(response);
    });

    // Get specific casino data
    this.app.get('/api/casino-debug/:casinoType', (req, res) => {
      const { casinoType } = req.params;
      const redisData = this.casinoData.redisData.get(casinoType);
      const socketData = this.casinoData.socketData.get(casinoType);

      if (!redisData && !socketData) {
        return res.status(404).json({ error: 'Casino not found' });
      }

      res.json({
        casinoType,
        redis: redisData || null,
        socket: socketData || null
      });
    });

    // Force refresh casino data
    this.app.post('/api/casino-debug/refresh', async (req, res) => {
      try {
        await this.refreshCasinoData();
        res.json({ success: true, message: 'Casino data refreshed' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to refresh casino data' });
      }
    });

    // Serve debug UI
    this.app.get('/debug', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'debug.html'));
    });
  }

  private setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Debug client connected:', socket.id);

      // Send initial data
      socket.emit('casinoDebugData', {
        ...this.casinoData,
        redisData: Object.fromEntries(this.casinoData.redisData),
        socketData: Object.fromEntries(this.casinoData.socketData)
      });

      // Handle requests for all casino data
      socket.on('requestAllCasinoData', () => {
        this.broadcastCasinoData();
      });

      socket.on('disconnect', () => {
        console.log('❌ Debug client disconnected:', socket.id);
      });
    });
  }

  private async initializeCasinoData() {
    // Initialize casino data structure
    this.casinoTypes.forEach(casinoType => {
      this.casinoData.redisData.set(casinoType, {
        casinoType,
        hasCurrent: false,
        hasResults: false,
        currentSize: 0,
        resultsSize: 0,
        lastRedisUpdate: null,
        lastSocketUpdate: null,
        status: 'inactive'
      });

      this.casinoData.socketData.set(casinoType, {
        casinoType,
        hasCurrent: false,
        hasResults: false,
        currentSize: 0,
        resultsSize: 0,
        lastRedisUpdate: null,
        lastSocketUpdate: null,
        status: 'inactive'
      });
    });

    // Initial data refresh
    await this.refreshCasinoData();

    // Set up periodic refresh
    setInterval(async () => {
      await this.refreshCasinoData();
    }, 30000); // Refresh every 30 seconds

    // Force Redis connection attempt
    setTimeout(async () => {
      try {
        await this.redis.ping();
        console.log('✅ Redis ping successful');
      } catch (error) {
        console.log('❌ Redis ping failed:', error);
      }
    }, 2000);
  }

  private async refreshCasinoData() {
    console.log('🔄 Refreshing casino debug data...');

    try {
      // Check if Redis is connected
      if (this.redis.status !== 'ready') {
        console.log(`⚠️  Redis status: ${this.redis.status}, attempting to connect...`);
        this.casinoData.redisStatus = this.redis.status;
        this.casinoData.redisConnected = false;
        
        // Try to ping Redis to check connection
        try {
          await this.redis.ping();
          console.log('✅ Redis ping successful, connection is working');
          this.casinoData.redisConnected = true;
          this.casinoData.redisStatus = 'ready';
        } catch (pingError) {
          console.log('❌ Redis ping failed, marking all casinos as inactive...');
          this.casinoData.redisConnected = false;
          this.casinoData.redisStatus = 'error';
          for (const casinoType of this.casinoTypes) {
            const redisCasino = this.casinoData.redisData.get(casinoType);
            if (redisCasino) {
              redisCasino.status = 'inactive';
              redisCasino.hasCurrent = false;
              redisCasino.hasResults = false;
              redisCasino.currentSize = 0;
              redisCasino.resultsSize = 0;
              redisCasino.redisData = null;
            }
          }
          return;
        }
      } else {
        this.casinoData.redisConnected = true;
        this.casinoData.redisStatus = this.redis.status;
      }

      // Check Redis data for each casino
      for (const casinoType of this.casinoTypes) {
        const currentKey = `casino:${casinoType}:current`;
        const resultsKey = `casino:${casinoType}:results`;

        try {
          const [currentData, resultsData] = await Promise.all([
            this.redis.get(currentKey).catch(() => null),
            this.redis.get(resultsKey).catch(() => null)
          ]);

                      const redisCasino = this.casinoData.redisData.get(casinoType);
            if (redisCasino) {
              redisCasino.hasCurrent = !!currentData;
              redisCasino.hasResults = !!resultsData;
              redisCasino.currentSize = currentData ? currentData.length : 0;
              redisCasino.resultsSize = resultsData ? resultsData.length : 0;
              redisCasino.lastRedisUpdate = new Date();
              
              // Parse and structure the data properly
              try {
                if (currentData) {
                  const parsedCurrent = JSON.parse(currentData);
                  redisCasino.redisData = {
                    current: parsedCurrent,
                    results: resultsData ? JSON.parse(resultsData) : null
                  };
                } else if (resultsData) {
                  const parsedResults = JSON.parse(resultsData);
                  redisCasino.redisData = {
                    current: null,
                    results: parsedResults
                  };
                } else {
                  redisCasino.redisData = null;
                }
              } catch (parseError) {
                console.log(`❌ Error parsing data for ${casinoType}:`, parseError);
                redisCasino.redisData = null;
              }
              
              redisCasino.status = (redisCasino.hasCurrent || redisCasino.hasResults) ? 'active' : 'inactive';
            }
        } catch (error: any) {
          console.log(`❌ Error checking Redis for ${casinoType}:`, error.message);
          const redisCasino = this.casinoData.redisData.get(casinoType);
          if (redisCasino) {
            redisCasino.status = 'error';
          }
        }
      }

      // Calculate stats
      const allCasinos = Array.from(this.casinoData.redisData.values());
      this.casinoData.totalCasinos = allCasinos.length;
      this.casinoData.activeCasinos = allCasinos.filter(c => c.status === 'active').length;
      this.casinoData.inactiveCasinos = allCasinos.filter(c => c.status === 'inactive').length;
      this.casinoData.errors = allCasinos.filter(c => c.status === 'error').length;
      this.casinoData.lastUpdate = new Date();

      // Broadcast updated data
      this.broadcastCasinoData();

      console.log(`✅ Casino debug data refreshed - Active: ${this.casinoData.activeCasinos}, Inactive: ${this.casinoData.inactiveCasinos}, Errors: ${this.casinoData.errors}`);
    } catch (error: any) {
      console.error('❌ Error refreshing casino debug data:', error.message);
    }
  }

  private broadcastCasinoData() {
    const data = {
      ...this.casinoData,
      redisData: Object.fromEntries(this.casinoData.redisData),
      socketData: Object.fromEntries(this.casinoData.socketData)
    };

    this.io.emit('casinoDebugData', data);
  }

  // Method to update socket data (called from external sources)
  public updateSocketData(casinoType: string, data: any) {
    const socketCasino = this.casinoData.socketData.get(casinoType);
    if (socketCasino) {
      socketCasino.lastSocketUpdate = new Date();
      socketCasino.socketData = data;
      socketCasino.hasCurrent = !!data?.current;
      socketCasino.hasResults = data?.results?.length > 0;
      socketCasino.currentSize = data?.current ? JSON.stringify(data.current).length : 0;
      socketCasino.resultsSize = data?.results ? JSON.stringify(data.results).length : 0;
      socketCasino.status = (socketCasino.hasCurrent || socketCasino.hasResults) ? 'active' : 'inactive';
    }
  }

  public start(port: number = 4001) {
    this.server.listen(port, () => {
      console.log(`🎰 Casino Debug Server running on port ${port}`);
      console.log(`📊 Debug UI available at: http://localhost:${port}/debug`);
      console.log(`🔌 Socket.IO available at: http://localhost:${port}`);
      console.log(`📡 API available at: http://localhost:${port}/api/casino-debug`);
    });
  }
}

// Export for use in other files
export { CasinoDebugServer };

// Start server if this file is run directly
if (require.main === module) {
  const debugServer = new CasinoDebugServer();
  debugServer.start(4001);
}
