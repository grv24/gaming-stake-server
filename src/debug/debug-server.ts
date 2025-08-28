import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import dotenv from 'dotenv';
import io from 'socket.io-client';
import { DataSource } from 'typeorm';
import { CasinoBet } from '../entities/casino/CasinoBet';
import { CasinoMatch } from '../entities/casino/CasinoMatch';
import { DefaultCasino } from '../entities/casino/DefaultCasino';
import { fetchAndUpdateCasinoOdds } from '../services/casino/CasinoService';
import { getRedisClient } from '../config/redisConfig';
import { getRedisPublisher } from '../config/redisPubSub';

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
  apiResponse?: any;
  apiError?: string;
  lastApiCall?: Date;
}

interface CasinoBetData {
  casinoType: string;
  totalBets: number;
  pendingBets: number;
  wonBets: number;
  lostBets: number;
  totalStake: number;
  totalProfit: number;
  lastBetUpdate: Date | null;
  recentBets: any[];
  status: 'active' | 'inactive' | 'error';
  betDetails?: any[];
}

interface CasinoDebugData {
  redisData: Map<string, CasinoData>;
  socketData: Map<string, CasinoData>;
  betData: Map<string, CasinoBetData>;
  totalCasinos: number;
  activeCasinos: number;
  inactiveCasinos: number;
  errors: number;
  lastUpdate: Date;
  redisConnected: boolean;
  redisStatus: string;
  dbConnected: boolean;
  dbStatus: string;
  apiStats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
    lastCallTime: Date | null;
  };
}

class CasinoDebugServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private redis: Redis;
  private mainSocketClient: any; // Connection to main Socket.IO server
  private dataSource: DataSource; // Database connection
  private casinoData: CasinoDebugData;
  private casinoTypes: string[];
  private updateInterval: NodeJS.Timeout | null = null;

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

    // Initialize Database connection
    this.dataSource = new DataSource({
      type: "postgres",
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      username: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      entities: [CasinoBet, CasinoMatch, DefaultCasino],
      synchronize: false,
      logging: false
    });

    this.casinoTypes = [
      'dt6', 'teen', 'poker', 'teen20', 'teen9', 'teen8', 'poker20', 'poker6', 'card32eu', 'war',
      'lucky5', 'joker20', 'joker1', 'ab4', 'lottcard',
      'aaa', 'abj', 'dt20', 'lucky7eu', 'dt202', 'teenmuf', 'teen20c', 'btable2', 'goal', 'baccarat2'
    ];

    this.casinoData = {
      redisData: new Map(),
      socketData: new Map(),
      betData: new Map(),
      totalCasinos: 0,
      activeCasinos: 0,
      inactiveCasinos: 0,
      errors: 0,
      lastUpdate: new Date(),
      redisConnected: false,
      redisStatus: 'disconnected',
      dbConnected: false,
      dbStatus: 'disconnected',
      apiStats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0,
        lastCallTime: null
      }
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.connectToMainSocketIO();
    this.initializeCasinoData();
    this.startPeriodicUpdates();
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
        database: this.dataSource.isInitialized ? 'connected' : 'disconnected',
        socket: this.io.engine.clientsCount
      });
    });

    // Get all casino debug data
    this.app.get('/api/casino-debug', (req, res) => {
      const response = {
        ...this.casinoData,
        redisData: Object.fromEntries(this.casinoData.redisData),
        socketData: Object.fromEntries(this.casinoData.socketData),
        betData: Object.fromEntries(this.casinoData.betData)
      };
      res.json(response);
    });

    // Get specific casino data
    this.app.get('/api/casino-debug/:casinoType', (req, res) => {
      const { casinoType } = req.params;
      const redisData = this.casinoData.redisData.get(casinoType);
      const socketData = this.casinoData.socketData.get(casinoType);
      const betData = this.casinoData.betData.get(casinoType);

      if (!redisData && !socketData && !betData) {
        return res.status(404).json({ error: 'Casino not found' });
      }

      res.json({
        casinoType,
        redis: redisData || null,
        socket: socketData || null,
        bets: betData || null
      });
    });

    // Get casino bets data
    this.app.get('/api/casino-bets', async (req, res) => {
      try {
        const betData = Object.fromEntries(this.casinoData.betData);
        res.json({
          success: true,
          data: betData,
          dbConnected: this.casinoData.dbConnected,
          dbStatus: this.casinoData.dbStatus
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bet data' });
      }
    });

    // NEW: Test casino API manually
    this.app.post('/api/test-casino-api', async (req, res) => {
      try {
        const { casinoType } = req.body;
        
        if (!casinoType) {
          return res.status(400).json({ error: 'casinoType is required' });
        }

        if (!this.casinoTypes.includes(casinoType)) {
          return res.status(400).json({ 
            error: 'Invalid casino type', 
            validTypes: this.casinoTypes 
          });
        }

        console.log(`🧪 Testing casino API for: ${casinoType}`);
        const startTime = Date.now();
        
        const result = await fetchAndUpdateCasinoOdds(casinoType);
        const responseTime = Date.now() - startTime;

        // Update API stats
        this.casinoData.apiStats.totalCalls++;
        this.casinoData.apiStats.lastCallTime = new Date();
        
        if (result) {
          this.casinoData.apiStats.successfulCalls++;
          this.casinoData.apiStats.averageResponseTime = 
            (this.casinoData.apiStats.averageResponseTime + responseTime) / 2;
        } else {
          this.casinoData.apiStats.failedCalls++;
        }

        res.json({
          success: true,
          casinoType,
          result: result ? 'success' : 'failed',
          responseTime: `${responseTime}ms`,
          data: result,
          apiStats: this.casinoData.apiStats
        });

      } catch (error: any) {
        this.casinoData.apiStats.failedCalls++;
        res.status(500).json({ 
          error: 'API test failed', 
          message: error.message,
          apiStats: this.casinoData.apiStats
        });
      }
    });

    // NEW: Get casino matches from database
    this.app.get('/api/casino-matches/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        if (!this.dataSource.isInitialized) {
          return res.status(500).json({ error: 'Database not connected' });
        }

        const matchRepo = this.dataSource.getRepository(CasinoMatch);
        const matches = await matchRepo.find({
          where: { casinoType },
          order: { createdAt: 'DESC' },
          take: Number(limit),
          skip: Number(offset)
        });

        res.json({
          success: true,
          casinoType,
          matches,
          total: matches.length
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch matches', message: error.message });
      }
    });

    // NEW: Get casino bets from database
    this.app.get('/api/casino-bets-db/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        const { limit = 20, offset = 0, status } = req.query;

        if (!this.dataSource.isInitialized) {
          return res.status(500).json({ error: 'Database not connected' });
        }

                 const betRepo = this.dataSource.getRepository(CasinoBet);
         const queryBuilder = betRepo.createQueryBuilder('bet')
           .where("bet.\"betData\"->>'gameSlug' = :casinoType", { casinoType });
         
         if (status) {
           queryBuilder.andWhere("bet.status = :status", { status });
         }

         const bets = await queryBuilder
           .orderBy('bet.createdAt', 'DESC')
           .take(Number(limit))
           .skip(Number(offset))
           .getMany();

        res.json({
          success: true,
          casinoType,
          bets,
          total: bets.length,
          filters: { status }
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch bets', message: error.message });
      }
    });

    // NEW: Force refresh casino data
    this.app.post('/api/refresh-casino/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        if (!this.casinoTypes.includes(casinoType)) {
          return res.status(400).json({ 
            error: 'Invalid casino type', 
            validTypes: this.casinoTypes 
          });
        }

        console.log(`🔄 Force refreshing casino data for: ${casinoType}`);
        
        // Force refresh from API
        const result = await fetchAndUpdateCasinoOdds(casinoType);
        
        // Update debug data
        await this.updateCasinoData(casinoType);

        res.json({
          success: true,
          casinoType,
          refreshed: !!result,
          message: result ? 'Data refreshed successfully' : 'Failed to refresh data'
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Refresh failed', message: error.message });
      }
    });

    // NEW: Get Redis keys for casino
    this.app.get('/api/redis-keys/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        const keys = await this.redis.keys(`casino:${casinoType}:*`);
        const keyData: any = {};

        for (const key of keys) {
          const data = await this.redis.get(key);
          keyData[key] = data ? JSON.parse(data) : null;
        }

        res.json({
          success: true,
          casinoType,
          keys,
          data: keyData
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch Redis keys', message: error.message });
      }
    });

    // NEW: Clear Redis cache for casino
    this.app.delete('/api/clear-cache/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        const keys = await this.redis.keys(`casino:${casinoType}:*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }

        res.json({
          success: true,
          casinoType,
          clearedKeys: keys.length,
          message: `Cleared ${keys.length} cache keys`
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Failed to clear cache', message: error.message });
      }
    });

    // NEW: Get casino list from database
    this.app.get('/api/casino-list', async (req, res) => {
      try {
        if (!this.dataSource.isInitialized) {
          return res.status(500).json({ error: 'Database not connected' });
        }

        const casinoRepo = this.dataSource.getRepository(DefaultCasino);
        const { limit = 50, offset = 0, category, provider, search } = req.query;

        const queryBuilder = casinoRepo.createQueryBuilder('casino');

        // Add filters
        if (category) {
          queryBuilder.andWhere('casino.category = :category', { category });
        }
        if (provider) {
          queryBuilder.andWhere('casino.provider = :provider', { provider });
        }
        if (search) {
          queryBuilder.andWhere('(casino.gameName ILIKE :search OR casino.slug ILIKE :search)', { 
            search: `%${search}%` 
          });
        }

        const casinos = await queryBuilder
          .orderBy('casino.gameName', 'ASC')
          .take(Number(limit))
          .skip(Number(offset))
          .getMany();

        // Get total count for pagination
        const totalCount = await queryBuilder.getCount();

        // Get unique categories and providers for filters
        const categories = await casinoRepo
          .createQueryBuilder('casino')
          .select('DISTINCT casino.category', 'category')
          .orderBy('casino.category', 'ASC')
          .getRawMany();

        const providers = await casinoRepo
          .createQueryBuilder('casino')
          .select('DISTINCT casino.provider', 'provider')
          .orderBy('casino.provider', 'ASC')
          .getRawMany();

        res.json({
          success: true,
          data: {
            casinos,
            pagination: {
              total: totalCount,
              limit: Number(limit),
              offset: Number(offset),
              hasMore: Number(offset) + Number(limit) < totalCount
            },
            filters: {
              categories: categories.map(c => c.category),
              providers: providers.map(p => p.provider)
            }
          }
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch casino list', message: error.message });
      }
    });

    // NEW: Get specific casino by ID
    this.app.get('/api/casino-list/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!this.dataSource.isInitialized) {
          return res.status(500).json({ error: 'Database not connected' });
        }

        const casinoRepo = this.dataSource.getRepository(DefaultCasino);
        const casino = await casinoRepo.findOne({ where: { id } });

        if (!casino) {
          return res.status(404).json({ error: 'Casino not found' });
        }

        res.json({
          success: true,
          data: casino
        });

      } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch casino', message: error.message });
      }
    });

    // NEW: Get casino odds (current match data) - Updated for new scenario
    this.app.get('/api/casino-odds/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        if (!casinoType) {
          return res.status(400).json({
            success: false,
            error: 'casinoType is required'
          });
        }

        const redisClient = getRedisClient();
        const cacheKey = `casino:${casinoType}:current`;

        // 1. Check Redis for current match
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          // Start socket connection for this casino type
          if (this.io) {
            this.io.emit('startCasinoUpdates', { casinoType });
            console.log(`🔌 Started socket updates for: ${casinoType}`);
          }

          // Join the casino room in main socket
          if (this.mainSocketClient) {
            this.mainSocketClient.emit('joinCasino', casinoType);
            this.mainSocketClient.emit('joinCasinos', [casinoType]);
            console.log(`🔌 Joined casino room for: ${casinoType}`);
          }

          return res.status(200).json({
            success: true,
            message: 'Current match data from cache with socket updates',
            data: JSON.parse(cachedData),
            source: 'redis_cache_with_socket',
            timestamp: Date.now(),
            socketStarted: true
          });
        }

        // 2. If cache miss → fetch + update
        const { fetchAndUpdateCasinoOdds } = await import('../services/casino/CasinoService');
        const freshData = await fetchAndUpdateCasinoOdds(casinoType);
        
        if (!freshData?.data) {
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch odds'
          });
        }

        // Start socket connection for this casino type
        if (this.io) {
          this.io.emit('startCasinoUpdates', { casinoType });
          console.log(`🔌 Started socket updates for: ${casinoType}`);
        }

        // Join the casino room in main socket
        if (this.mainSocketClient) {
          this.mainSocketClient.emit('joinCasino', casinoType);
          this.mainSocketClient.emit('joinCasinos', [casinoType]);
          console.log(`🔌 Joined casino room for: ${casinoType}`);
        }

        return res.status(200).json({
          success: true,
          message: 'Current match data fetched fresh with socket updates',
          data: freshData.data,
          source: 'api_fresh_with_socket',
          timestamp: Date.now(),
          socketStarted: true
        });
      } catch (error: any) {
        console.error('Error fetching casino odds:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch casino odds',
          details: error.message 
        });
      }
    });

    // NEW: Start socket updates for a casino
    this.app.post('/api/socket/start/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        if (!casinoType) {
          return res.status(400).json({
            success: false,
            error: 'casinoType is required'
          });
        }

        // Start socket connection for this casino type
        if (this.io) {
          this.io.emit('startCasinoUpdates', { casinoType });
          console.log(`🔌 Started socket updates for: ${casinoType}`);
        }

        // Join the casino room in main socket
        if (this.mainSocketClient) {
          this.mainSocketClient.emit('joinCasino', casinoType);
          console.log(`🔌 Joined casino room: ${casinoType}`);
          
          // Also join the room directly
          this.mainSocketClient.emit('joinCasinos', [casinoType]);
          console.log(`🔌 Joined casino room directly: ${casinoType}`);
        }

        res.json({
          success: true,
          message: `Socket updates started for ${casinoType}`,
          casinoType,
          timestamp: Date.now()
        });

      } catch (error: any) {
        console.error('Error starting socket updates:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to start socket updates',
          details: error.message 
        });
      }
    });

    // NEW: Stop socket updates for a casino
    this.app.post('/api/socket/stop/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        if (!casinoType) {
          return res.status(400).json({
            success: false,
            error: 'casinoType is required'
          });
        }

        // Stop socket connection for this casino type
        if (this.io) {
          this.io.emit('stopCasinoUpdates', { casinoType });
          console.log(`🔌 Stopped socket updates for: ${casinoType}`);
        }

        // Leave the casino room in main socket
        if (this.mainSocketClient) {
          this.mainSocketClient.emit('leaveCasino', casinoType);
          console.log(`🔌 Left casino room: ${casinoType}`);
          
          // Also leave the room directly
          this.mainSocketClient.emit('leaveCasinos', [casinoType]);
          console.log(`🔌 Left casino room directly: ${casinoType}`);
        }

        res.json({
          success: true,
          message: `Socket updates stopped for ${casinoType}`,
          casinoType,
          timestamp: Date.now()
        });

      } catch (error: any) {
        console.error('Error stopping socket updates:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to stop socket updates',
          details: error.message 
        });
      }
    });

    // NEW: Get active socket connections
    this.app.get('/api/socket/active', async (req, res) => {
      try {
        // Get active casino rooms from main socket
        const activeConnections = this.mainSocketClient ? 
          Object.keys(this.mainSocketClient.rooms || {}).filter(room => room.startsWith('casino:')) : [];

        res.json({
          success: true,
          activeConnections: activeConnections.map(room => room.replace('casino:', '')),
          totalActive: activeConnections.length,
          timestamp: Date.now()
        });

      } catch (error: any) {
        console.error('Error getting active connections:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to get active connections',
          details: error.message 
        });
      }
    });

    // NEW: Get casino results - Updated for new scenario
    this.app.get('/api/casino-results/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        if (!casinoType) {
          return res.status(400).json({
            success: false,
            error: 'casinoType is required'
          });
        }

        const redisClient = getRedisClient();
        const cacheKey = `casino:${casinoType}:results`;

        // 1. Check Redis for results
        const cachedResults = await redisClient.get(cacheKey);
        if (cachedResults) {
          return res.status(200).json({
            success: true,
            message: 'Results data from cache',
            results: JSON.parse(cachedResults),
            source: 'redis_cache',
            timestamp: Date.now()
          });
        }

        // 2. If cache miss → fetch + update
        const { fetchAndUpdateCasinoOdds } = await import('../services/casino/CasinoService');
        const freshData = await fetchAndUpdateCasinoOdds(casinoType);
        
        // Handle both result structures
        let results = [];
        if (freshData?.result?.res && Array.isArray(freshData.result.res)) {
          results = freshData.result.res;
        } else if (freshData?.result && Array.isArray(freshData.result)) {
          results = freshData.result;
        }
        
        if (results.length === 0) {
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch results'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Results data fetched fresh',
          results: results,
          source: 'api_fresh',
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('Error fetching casino results:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch casino results',
          details: error.message 
        });
      }
    });

    // NEW: Get casino odds and results together - Updated for new scenario
    this.app.get('/api/casino-data/:casinoType', async (req, res) => {
      try {
        const { casinoType } = req.params;
        
        if (!casinoType) {
          return res.status(400).json({
            success: false,
            error: 'casinoType is required'
          });
        }

        const redisClient = getRedisClient();
        const currentKey = `casino:${casinoType}:current`;
        const resultsKey = `casino:${casinoType}:results`;

        // Check Redis for both current and results
        const [cachedCurrent, cachedResults] = await Promise.all([
          redisClient.get(currentKey),
          redisClient.get(resultsKey)
        ]);

        let currentData = null;
        let resultsData = [];
        let source = 'redis_cache';

        if (cachedCurrent) {
          currentData = JSON.parse(cachedCurrent);
        }
        if (cachedResults) {
          resultsData = JSON.parse(cachedResults);
        }

        // If either is missing, fetch fresh data
        if (!cachedCurrent || !cachedResults) {
          const { fetchAndUpdateCasinoOdds } = await import('../services/casino/CasinoService');
          const freshData = await fetchAndUpdateCasinoOdds(casinoType);
          
          if (freshData?.data) {
            currentData = freshData.data;
          }
          
          if (freshData?.result?.res && Array.isArray(freshData.result.res)) {
            resultsData = freshData.result.res;
          } else if (freshData?.result && Array.isArray(freshData.result)) {
            resultsData = freshData.result;
          }
          
          source = 'api_fresh';
        }

        // Start socket connection for this casino type
        if (this.io && currentData) {
          this.io.emit('startCasinoUpdates', { casinoType });
          console.log(`🔌 Started socket updates for: ${casinoType}`);
        }

        // Join the casino room in main socket
        if (this.mainSocketClient && currentData) {
          this.mainSocketClient.emit('joinCasino', casinoType);
          this.mainSocketClient.emit('joinCasinos', [casinoType]);
          console.log(`🔌 Joined casino room for: ${casinoType}`);
        }

        return res.status(200).json({
          success: true,
          message: 'Complete casino data retrieved successfully',
          data: {
            casinoType,
            current: currentData,
            results: resultsData,
            hasCurrent: !!currentData,
            hasResults: resultsData.length > 0
          },
          source: source + '_with_socket',
          timestamp: Date.now(),
          socketStarted: !!currentData
        });
      } catch (error: any) {
        console.error('Error fetching casino data:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch casino data',
          details: error.message 
        });
      }
    });

    // NEW: Get system statistics
    this.app.get('/api/system-stats', (req, res) => {
      res.json({
        success: true,
        stats: {
          totalCasinos: this.casinoData.totalCasinos,
          activeCasinos: this.casinoData.activeCasinos,
          inactiveCasinos: this.casinoData.inactiveCasinos,
          errors: this.casinoData.errors,
          redisConnected: this.casinoData.redisConnected,
          dbConnected: this.casinoData.dbConnected,
          apiStats: this.casinoData.apiStats,
          lastUpdate: this.casinoData.lastUpdate
        }
      });
    });

    // Serve debug UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'debug.html'));
    });

    this.app.get('/debug', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'debug.html'));
    });
  }

  private setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Debug client connected: ${socket.id}`);

      // Send initial data
      socket.emit('casino-debug-data', {
        ...this.casinoData,
        redisData: Object.fromEntries(this.casinoData.redisData),
        socketData: Object.fromEntries(this.casinoData.socketData),
        betData: Object.fromEntries(this.casinoData.betData)
      });

      socket.on('request-casino-data', (casinoType: string) => {
        const redisData = this.casinoData.redisData.get(casinoType);
        const socketData = this.casinoData.socketData.get(casinoType);
        const betData = this.casinoData.betData.get(casinoType);

        socket.emit('casino-data', {
          casinoType,
          redis: redisData || null,
          socket: socketData || null,
          bets: betData || null
        });
      });

      socket.on('test-casino-api', async (casinoType: string) => {
        try {
          console.log(`🧪 Socket API test for: ${casinoType}`);
          const result = await fetchAndUpdateCasinoOdds(casinoType);
          
          socket.emit('api-test-result', {
            casinoType,
            success: !!result,
            data: result
          });
        } catch (error: any) {
          socket.emit('api-test-result', {
            casinoType,
            success: false,
            error: error.message
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Debug client disconnected: ${socket.id}`);
      });
    });
  }

  private async connectToMainSocketIO() {
    try {
      const mainSocketUrl = process.env.MAIN_SOCKET_URL || 'http://localhost:7080';
      console.log(`🔗 Connecting to main Socket.IO server: ${mainSocketUrl}`);
      
      this.mainSocketClient = io(mainSocketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      this.mainSocketClient.on('connect', () => {
        console.log('✅ Connected to main Socket.IO server');
        console.log('🔌 Socket ID:', this.mainSocketClient.id);
      });

      this.mainSocketClient.on('disconnect', () => {
        console.log('❌ Disconnected from main Socket.IO server');
      });

      this.mainSocketClient.on('connect_error', (error: any) => {
        console.log('❌ Connection error to main Socket.IO server:', error);
      });

      // Listen for casino updates from main server
      this.mainSocketClient.on('casinoOddsUpdate', (data: any) => {
        console.log('🎲 Received casino update from main server:', data);
        // Forward to debug clients
        this.io.emit('casinoOddsUpdate', data);
      });

      // Listen for any other events for debugging
      this.mainSocketClient.onAny((eventName: any, ...args: any[]) => {
        console.log(`🔍 Received event from main server: ${eventName}`, args);
      });

    } catch (error) {
      console.log('⚠️  Failed to connect to main Socket.IO server:', error);
    }
  }

  private async initializeCasinoData() {
    console.log('🔄 Initializing casino debug data...');
    
    // Initialize data for each casino type
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

      this.casinoData.betData.set(casinoType, {
        casinoType,
        totalBets: 0,
        pendingBets: 0,
        wonBets: 0,
        lostBets: 0,
        totalStake: 0,
        totalProfit: 0,
        lastBetUpdate: null,
        recentBets: [],
        status: 'inactive'
      });
    });

    this.casinoData.totalCasinos = this.casinoTypes.length;
    
    // Initial data fetch
    await this.updateAllCasinoData();
  }

  private startPeriodicUpdates() {
    // Removed old periodic updates - now using socket-based updates from main server
    console.log('🔄 Socket-based updates enabled - no periodic polling needed');
  }

  private async updateAllCasinoData() {
    try {
      // Update Redis connection status
      this.casinoData.redisConnected = this.redis.status === 'ready';
      this.casinoData.redisStatus = this.redis.status;

      // Update database connection status
      this.casinoData.dbConnected = this.dataSource.isInitialized;
      this.casinoData.dbStatus = this.dataSource.isInitialized ? 'connected' : 'disconnected';

      // Update Redis data for each casino
      for (const casinoType of this.casinoTypes) {
        await this.updateCasinoData(casinoType);
      }

      // Update bet data from database
      if (this.dataSource.isInitialized) {
        await this.updateBetData();
      }

      // Calculate statistics
      this.calculateStatistics();

      // Update timestamp
      this.casinoData.lastUpdate = new Date();

      // Broadcast to connected clients
      this.io.emit('casino-debug-update', {
        ...this.casinoData,
        redisData: Object.fromEntries(this.casinoData.redisData),
        socketData: Object.fromEntries(this.casinoData.socketData),
        betData: Object.fromEntries(this.casinoData.betData)
      });

    } catch (error) {
      console.error('Error updating casino data:', error);
      this.casinoData.errors++;
    }
  }

  private async updateCasinoData(casinoType: string) {
    try {
      const redisData = this.casinoData.redisData.get(casinoType);
      if (!redisData) return;

      // Check current match data
      const currentKey = `casino:${casinoType}:current`;
      const currentData = await this.redis.get(currentKey);
      
      if (currentData) {
        const parsedData = JSON.parse(currentData);
        redisData.hasCurrent = true;
        redisData.currentSize = JSON.stringify(parsedData).length;
        redisData.redisData = parsedData;
        redisData.lastRedisUpdate = new Date();
        redisData.status = 'active';
      } else {
        redisData.hasCurrent = false;
        redisData.currentSize = 0;
        redisData.redisData = null;
        redisData.status = 'inactive';
      }

      // Check results data
      const resultsKey = `casino:${casinoType}:results`;
      const resultsData = await this.redis.get(resultsKey);
      
      if (resultsData) {
        const parsedResults = JSON.parse(resultsData);
        redisData.hasResults = true;
        redisData.resultsSize = JSON.stringify(parsedResults).length;
        redisData.status = 'active';
      } else {
        redisData.hasResults = false;
        redisData.resultsSize = 0;
      }

    } catch (error) {
      console.error(`Error updating casino data for ${casinoType}:`, error);
      const redisData = this.casinoData.redisData.get(casinoType);
      if (redisData) {
        redisData.status = 'error';
        redisData.apiError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  }

  private async updateBetData() {
    try {
      const betRepo = this.dataSource.getRepository(CasinoBet);

      for (const casinoType of this.casinoTypes) {
        const betData = this.casinoData.betData.get(casinoType);
        if (!betData) continue;

                 // Get bet statistics using QueryBuilder for JSONB queries
         const [totalBets, pendingBets, wonBets, lostBets] = await Promise.all([
           betRepo.createQueryBuilder('bet')
             .where("bet.\"betData\"->>'gameSlug' = :casinoType", { casinoType })
             .getCount(),
           betRepo.createQueryBuilder('bet')
             .where("bet.\"betData\"->>'gameSlug' = :casinoType AND bet.status = :status", { casinoType, status: 'pending' })
             .getCount(),
           betRepo.createQueryBuilder('bet')
             .where("bet.\"betData\"->>'gameSlug' = :casinoType AND bet.status = :status", { casinoType, status: 'won' })
             .getCount(),
           betRepo.createQueryBuilder('bet')
             .where("bet.\"betData\"->>'gameSlug' = :casinoType AND bet.status = :status", { casinoType, status: 'lost' })
             .getCount()
         ]);

         // Get recent bets
         const recentBets = await betRepo.createQueryBuilder('bet')
           .where("bet.\"betData\"->>'gameSlug' = :casinoType", { casinoType })
           .orderBy('bet.createdAt', 'DESC')
           .take(10)
           .getMany();

        // Calculate totals
        const totalStake = recentBets.reduce((sum, bet) => {
          const stake = bet.betData?.stake ? Number(bet.betData.stake) : 0;
          return sum + stake;
        }, 0);

        const totalProfit = recentBets.reduce((sum, bet) => {
          const profit = bet.betData?.result?.profitLoss ? Number(bet.betData.result.profitLoss) : 0;
          return sum + profit;
        }, 0);

        // Update bet data
        betData.totalBets = totalBets;
        betData.pendingBets = pendingBets;
        betData.wonBets = wonBets;
        betData.lostBets = lostBets;
        betData.totalStake = totalStake;
        betData.totalProfit = totalProfit;
        betData.recentBets = recentBets;
        betData.lastBetUpdate = new Date();
        betData.status = totalBets > 0 ? 'active' : 'inactive';
      }

    } catch (error) {
      console.error('Error updating bet data:', error);
    }
  }

  private updateSocketData(casinoType: string, data: any) {
    const socketData = this.casinoData.socketData.get(casinoType);
    if (socketData) {
      socketData.hasCurrent = !!data.current;
      socketData.hasResults = data.results && data.results.length > 0;
      socketData.currentSize = data.current ? JSON.stringify(data.current).length : 0;
      socketData.resultsSize = data.results ? JSON.stringify(data.results).length : 0;
      socketData.socketData = data;
      socketData.lastSocketUpdate = new Date();
      socketData.status = 'active';
    }
  }

  private calculateStatistics() {
    let activeCasinos = 0;
    let inactiveCasinos = 0;
    let errors = 0;

    this.casinoData.redisData.forEach((data) => {
      if (data.status === 'active') {
        activeCasinos++;
      } else if (data.status === 'inactive') {
        inactiveCasinos++;
      } else if (data.status === 'error') {
        errors++;
      }
    });

    this.casinoData.activeCasinos = activeCasinos;
    this.casinoData.inactiveCasinos = inactiveCasinos;
    this.casinoData.errors = errors;
  }

  public async start() {
    try {
      // Connect to Redis (handle if already connected)
      try {
        if (this.redis.status === 'ready') {
          console.log('✅ Redis already connected');
        } else {
          await this.redis.connect();
          console.log('✅ Redis connected');
        }
      } catch (redisError: any) {
        if (redisError.message.includes('already connecting/connected')) {
          console.log('✅ Redis already connected');
        } else {
          console.log('⚠️  Redis connection issue:', redisError.message);
        }
      }

      // Connect to Database
      await this.dataSource.initialize();
      console.log('✅ Database connected');

      const PORT = process.env.DEBUG_PORT || 4002;
      this.server.listen(PORT, () => {
        console.log(`🎯 Casino Debug Server running on port ${PORT}`);
        console.log(`📊 Debug UI available at: http://localhost:${PORT}`);
        console.log(`🔍 API endpoints available at: http://localhost:${PORT}/api/`);
      });

    } catch (error) {
      console.error('❌ Failed to start debug server:', error);
      process.exit(1);
    }
  }

  public async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.mainSocketClient) {
      this.mainSocketClient.disconnect();
    }
    
    await this.redis.disconnect();
    await this.dataSource.destroy();
    
    this.server.close(() => {
      console.log('🛑 Debug server stopped');
    });
  }
}

// Export the class for use in other files
export { CasinoDebugServer };

// Start the debug server if this file is run directly
if (require.main === module) {
  const debugServer = new CasinoDebugServer();
  debugServer.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down debug server...');
    await debugServer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down debug server...');
    await debugServer.stop();
    process.exit(0);
  });
}

