const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8085;

app.use(cors());
app.use(express.json());

// Mock casino data
const mockCasinoData = {
  dt6: {
    data: {
      mid: `mock_dt6_${Date.now()}`,
      status: 'live',
      current: 'A',
      time: Date.now()
    },
    result: {
      res: [
        {
          mid: `result_dt6_1`,
          win: 'A',
          time: Date.now() - 60000
        }
      ]
    }
  },
  teen: {
    data: {
      mid: `mock_teen_${Date.now()}`,
      status: 'live',
      current: 'B',
      time: Date.now()
    },
    result: {
      res: [
        {
          mid: `result_teen_1`,
          win: 'B',
          time: Date.now() - 60000
        }
      ]
    }
  },
  poker: {
    data: {
      mid: `mock_poker_${Date.now()}`,
      status: 'live',
      current: 'C',
      time: Date.now()
    },
    result: {
      res: [
        {
          mid: `result_poker_1`,
          win: 'C',
          time: Date.now() - 60000
        }
      ]
    }
  }
};

// Mock sports data
const mockSportsData = {
  cricket: {
    matches: [
      {
        id: 'cricket_1',
        teams: ['Team A', 'Team B'],
        status: 'live',
        odds: { teamA: 1.5, teamB: 2.5 }
      }
    ]
  },
  soccer: {
    matches: [
      {
        id: 'soccer_1',
        teams: ['Team X', 'Team Y'],
        status: 'live',
        odds: { teamX: 1.8, teamY: 2.2 }
      }
    ]
  },
  tennis: {
    matches: [
      {
        id: 'tennis_1',
        players: ['Player 1', 'Player 2'],
        status: 'live',
        odds: { player1: 1.6, player2: 2.4 }
      }
    ]
  }
};

// Casino endpoint
app.get('/api/new/casino', (req, res) => {
  const { casinoType } = req.query;
  
  if (!casinoType) {
    return res.status(400).json({ error: 'casinoType is required' });
  }
  
  const data = mockCasinoData[casinoType] || {
    data: {
      mid: `mock_${casinoType}_${Date.now()}`,
      status: 'live',
      current: 'A',
      time: Date.now()
    },
    result: {
      res: [
        {
          mid: `result_${casinoType}_1`,
          win: 'A',
          time: Date.now() - 60000
        }
      ]
    }
  };
  
  // Simulate some delay
  setTimeout(() => {
    res.json(data);
  }, Math.random() * 1000); // Random delay 0-1 second
});

// Sports endpoints
app.get('/api/new/getlistdata', (req, res) => {
  const { sport_id } = req.query;
  
  if (!sport_id) {
    return res.status(400).json({ error: 'sport_id is required' });
  }
  
  const data = mockSportsData[sport_id] || { matches: [] };
  
  setTimeout(() => {
    res.json(data);
  }, Math.random() * 500);
});

app.get('/api/new/getdataodds', (req, res) => {
  const { sport_id, eventid } = req.query;
  
  if (!sport_id || !eventid) {
    return res.status(400).json({ error: 'sport_id and eventid are required' });
  }
  
  const data = {
    sport_id,
    event_id: eventid,
    odds: {
      home: 1.5,
      away: 2.5,
      draw: 3.0
    },
    timestamp: Date.now()
  };
  
  setTimeout(() => {
    res.json(data);
  }, Math.random() * 500);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`🎯 Mock External API running on port ${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   - GET /api/new/casino?casinoType=<type>`);
  console.log(`   - GET /api/new/getlistdata?sport_id=<id>`);
  console.log(`   - GET /api/new/getdataodds?sport_id=<id>&eventid=<id>`);
  console.log(`   - GET /health`);
  console.log('');
  console.log(`💡 Test with: curl http://localhost:${PORT}/health`);
});
