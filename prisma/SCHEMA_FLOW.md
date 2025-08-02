# Gaming Stake Server - Schema Flow Documentation

## Overview
This document explains the database schema flow and relationships for the gaming stake server. The system follows a hierarchical user structure with centralized settings management and hierarchical commission/partnership calculations.

## Schema Flow

```
Different User Types → BaseUser → UserSettings → SoccerSettings → Hierarchical MatchCommission & Partnership
```

### 1. User Hierarchy

#### BaseUser (Central User Model)
- **Purpose**: Contains common user data and authentication information
- **Key Fields**: 
  - `id`, `loginId`, `userName`, `mobile`, `countryCode`
  - Authentication fields: `user_password`, `encry_password`, `salt`
  - Status fields: `idIsActive`, `isAutoRegisteredUser`
  - Hierarchy: `uplineId` for user hierarchy
  - Locking: `fancyLocked`, `bettingLocked`, `userLocked`, `closedAccounts`

#### Child User Models (Inheritance Pattern)
Each user type extends BaseUser with specific functionality:

- **Client** (Level 0): End users who place bets
- **Agent** (Level 1): Users who manage clients
- **SuperAgent** (Level 2): Users who manage agents
- **Master** (Level 3): Users who manage super agents
- **SuperMaster** (Level 4): Users who manage masters
- **MiniAdmin** (Level 5): Administrative users with limited permissions
- **Admin** (Level 6): Full administrative users
- **TechAdmin** (Level 7): Technical administrative users
- **Developer** (Level 8): System developers

### 2. UserSettings (Centralized Settings Management)

#### Purpose
- Centralizes all user-specific settings
- Provides a single point of configuration for each user
- Enables easy extension for new sports/games

#### Relationships
- **One-to-One** with BaseUser
- **One-to-One** with SoccerSettings (and future sports settings)

#### Key Benefits
- Clean separation of concerns
- Easy to add new sports settings
- Consistent settings management across user types

### 3. SoccerSettings (Sports-Specific Configuration)

#### Purpose
- Contains all soccer-specific betting configurations
- Manages betting limits, odds, delays, and exposure settings
- Links to hierarchical commission and partnership structures

#### Key Fields
- **Betting Limits**: `minOddsToBet`, `maxOddsToBet`, `minMatchStake`, `maxMatchStake`
- **Delays**: `betDelay`, `bookMakerDelay`
- **Exposure**: `minExposure`, `maxExposure`, `maxProfit`, `maxLoss`
- **Sport Reference**: Links to `DefaultSport` for sport-specific configurations

#### Relationships
- **One-to-One** with UserSettings
- **One-to-One** with MatchCommission
- **One-to-One** with Partnership
- **Many-to-One** with DefaultSport

### 4. Hierarchical Commission & Partnership System

#### MatchCommission (Hierarchical Commission)
- **Purpose**: Manages hierarchical commission structures for soccer betting
- **Key Fields**: 
  - `matchCommission`, `commissionType`, `isActive`
  - `userType`, `hierarchyLevel`, `isDefault`
  - `appliesToUserType`, `appliesToUserId` (for scope control)
- **Hierarchy Logic**:
  - When a client creates soccer settings, commission is calculated for all users above in hierarchy
  - Each user type can set commission rates for users below them
  - Commission flows upward through the hierarchy

#### Partnership (Hierarchical Partnership)
- **Purpose**: Manages hierarchical partnership structures for soccer betting
- **Key Fields**: 
  - `partnership`, `partnershipType`, `isActive`
  - `userType`, `hierarchyLevel`, `isDefault`
  - `appliesToUserType`, `appliesToUserId` (for scope control)
- **Hierarchy Logic**:
  - Similar to commission but for partnership calculations
  - Partnership benefits flow upward through the hierarchy

#### Hierarchy Levels
```
Level 0: Client (End users)
Level 1: Agent (Manages clients)
Level 2: SuperAgent (Manages agents)
Level 3: Master (Manages super agents)
Level 4: SuperMaster (Manages masters)
Level 5: MiniAdmin (Limited admin)
Level 6: Admin (Full admin)
Level 7: TechAdmin (Technical admin)
Level 8: Developer (System developer)
```

### 5. DefaultSport (Sport Management)

#### Purpose
- Centralized sport definitions
- Enables easy sport management and configuration
- Provides sport-specific settings reference

#### Key Fields
- `name`, `code`, `isActive`
- Timestamps for audit trail

## Database Relationships

### One-to-One Relationships
1. **BaseUser ↔ UserSettings**: Each user has exactly one settings record
2. **UserSettings ↔ SoccerSettings**: Each settings record can have one soccer configuration
3. **SoccerSettings ↔ MatchCommission**: Each soccer setting can have one commission structure
4. **SoccerSettings ↔ Partnership**: Each soccer setting can have one partnership structure

### One-to-Many Relationships
1. **BaseUser → MatchCommission**: A user can have multiple commission records
2. **BaseUser → Partnership**: A user can have multiple partnership records
3. **DefaultSport → SoccerSettings**: A sport can have multiple soccer settings

### Many-to-One Relationships
1. **UserSettings → BaseUser**: Settings belong to one user
2. **SoccerSettings → UserSettings**: Soccer settings belong to one settings record
3. **SoccerSettings → DefaultSport**: Soccer settings reference one sport

## Hierarchical Commission Logic

### Commission Flow
When a client places a bet:
1. **Client Level (0)**: No commission (end user)
2. **Agent Level (1)**: Gets commission from client's bets
3. **SuperAgent Level (2)**: Gets commission from agent's earnings
4. **Master Level (3)**: Gets commission from super agent's earnings
5. **SuperMaster Level (4)**: Gets commission from master's earnings
6. **Admin Levels (5-8)**: Get commission from their respective levels

### Commission Calculation Example
```typescript
// When a client places a bet of $1000
const betAmount = 1000;

// Commission structure (example)
const commissionStructure = {
  agent: { rate: 2.5, type: "percentage" },
  superAgent: { rate: 1.5, type: "percentage" },
  master: { rate: 1.0, type: "percentage" },
  superMaster: { rate: 0.5, type: "percentage" }
};

// Commission calculations
const agentCommission = betAmount * (2.5 / 100); // $25
const superAgentCommission = agentCommission * (1.5 / 100); // $0.375
const masterCommission = superAgentCommission * (1.0 / 100); // $0.00375
const superMasterCommission = masterCommission * (0.5 / 100); // $0.00001875
```

### Partnership Flow
Similar to commission but for partnership benefits:
1. **Client Level**: No partnership (end user)
2. **Agent Level**: Gets partnership from client's activity
3. **SuperAgent Level**: Gets partnership from agent's activity
4. **Master Level**: Gets partnership from super agent's activity
5. **SuperMaster Level**: Gets partnership from master's activity
6. **Admin Levels**: Get partnership from their respective levels

## Benefits of This Structure

### 1. Scalability
- Easy to add new sports (TennisSettings, CricketSettings, etc.)
- Consistent pattern for all sports configurations
- Centralized user management
- Hierarchical commission system scales with user growth

### 2. Maintainability
- Clear separation of concerns
- Single source of truth for user settings
- Easy to extend and modify
- Hierarchical logic is clearly defined

### 3. Performance
- Optimized queries through proper indexing
- Efficient relationship traversal
- Minimal data duplication
- Commission calculations are optimized

### 4. Flexibility
- Support for different user types with specific requirements
- Configurable commission and partnership structures
- Extensible sports system
- Hierarchical commission system supports complex business models

## Usage Examples

### Creating Hierarchical Commission Structure
```typescript
// When a client creates soccer settings, set up commission for upline
const createHierarchicalCommission = async (clientId: string, soccerSettingsId: string) => {
  const client = await prisma.baseUser.findUnique({
    where: { id: clientId },
    include: { upline: true }
  });

  // Get the full upline hierarchy
  const uplineHierarchy = await getUplineHierarchy(clientId);
  
  // Create commission records for each upline level
  for (const upline of uplineHierarchy) {
    await prisma.matchCommission.create({
      data: {
        userId: upline.id,
        userType: upline.__type,
        hierarchyLevel: getHierarchyLevel(upline.__type),
        matchCommission: getDefaultCommissionRate(upline.__type),
        commissionType: "percentage",
        isActive: true,
        appliesToUserType: "client",
        appliesToUserId: clientId,
        soccerSettingsId: soccerSettingsId
      }
    });
  }
};

// Get upline hierarchy
const getUplineHierarchy = async (userId: string) => {
  const user = await prisma.baseUser.findUnique({
    where: { id: userId },
    include: {
      upline: {
        include: {
          upline: {
            include: {
              upline: true // Continue as needed
            }
          }
        }
      }
    }
  });
  
  return flattenUplineHierarchy(user);
};
```

### Calculating Commission for a Bet
```typescript
const calculateBetCommission = async (clientId: string, betAmount: number) => {
  // Get client's soccer settings and commission structure
  const clientSettings = await prisma.baseUser.findUnique({
    where: { id: clientId },
    include: {
      userSettings: {
        include: {
          soccerSettings: {
            include: {
              matchCommission: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      }
    }
  });

  // Calculate commission for each upline level
  const commissionBreakdown = [];
  
  for (const commission of clientSettings.userSettings.soccerSettings.matchCommission) {
    const commissionAmount = betAmount * (commission.matchCommission / 100);
    
    commissionBreakdown.push({
      userId: commission.userId,
      userType: commission.userType,
      commissionAmount,
      commissionRate: commission.matchCommission
    });
  }
  
  return commissionBreakdown;
};
```

### Querying User Settings with Hierarchy
```typescript
// Get user with all settings and upline commission structure
const userWithHierarchy = await prisma.baseUser.findUnique({
  where: { id: userId },
  include: {
    userSettings: {
      include: {
        soccerSettings: {
          include: {
            matchCommission: {
              include: {
                user: true
              }
            },
            partnership: {
              include: {
                user: true
              }
            },
            sport: true,
          }
        }
      }
    },
    upline: {
      include: {
        matchCommissions: true,
        partnerships: true
      }
    }
  }
});
```

## Future Extensions

### Adding New Sports
1. Create new sport settings model (e.g., `TennisSettings`)
2. Add relationship to `UserSettings`
3. Create corresponding commission/partnership models if needed
4. Update `DefaultSport` with new sport entries
5. Extend hierarchical commission logic for new sports

### Adding New User Types
1. Create new user model extending `BaseUser`
2. Add relationship in `BaseUser`
3. Implement specific functionality for the new user type
4. Update hierarchy levels and commission calculations

### Adding New Commission Types
1. Extend `MatchCommission` or create new commission models
2. Add relationships to appropriate settings models
3. Update business logic to handle new commission structures
4. Extend hierarchical calculation logic

### Advanced Commission Features
1. **Dynamic Commission Rates**: Based on volume, time, or other factors
2. **Commission Tiers**: Different rates for different bet amounts
3. **Commission Bonuses**: Special bonuses for high performers
4. **Commission Caps**: Maximum commission limits
5. **Commission Periods**: Monthly, weekly, or daily commission cycles 