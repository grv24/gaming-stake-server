import { DataSource } from 'typeorm';
import { TechAdmin } from './src/entities/users/TechAdminUser';
import { Admin } from './src/entities/users/AdminUser';
import { Client } from './src/entities/users/ClientUser';
import { AccountTrasaction } from './src/entities/Transactions/AccountTransactions';

// Database Configuration - only load specific entities
const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [TechAdmin, Admin, Client, AccountTrasaction],
  synchronize: false,
  logging: false,
});

async function checkDownlineData() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    // Get TechAdmin user
    const techAdminRepo = AppDataSource.getRepository(TechAdmin);
    const techAdmin = await techAdminRepo.findOne({
      where: { loginId: 'bluebet9Tech' }
    });

    if (!techAdmin) {
      console.log('TechAdmin not found');
      return;
    }

    console.log('\n=== TECHADMIN DATA ===');
    console.log('ID:', techAdmin.id);
    console.log('Login ID:', techAdmin.loginId);
    console.log('Balance:', techAdmin.balance);
    console.log('Profit Loss:', techAdmin.profitLoss);
    console.log('Credit Ref:', techAdmin.creditRef);

    // Get Admin users under this TechAdmin
    const adminRepo = AppDataSource.getRepository(Admin);
    const admins = await adminRepo.find({
      where: { uplineId: techAdmin.id }
    });

    console.log('\n=== ADMIN USERS ===');
    console.log('Count:', admins.length);
    for (const admin of admins) {
      console.log(`- Admin: ${admin.loginId} (ID: ${admin.id})`);
      console.log(`  Balance: ${admin.balance}, Profit Loss: ${admin.profitLoss}, Credit Ref: ${admin.creditRef}`);
    }

    // Get Client users under this TechAdmin (through all levels)
    const clientRepo = AppDataSource.getRepository(Client);
    const clients = await clientRepo.find({
      where: { uplineId: techAdmin.id }
    });

    console.log('\n=== CLIENT USERS ===');
    console.log('Count:', clients.length);
    for (const client of clients) {
      console.log(`- Client: ${client.loginId} (ID: ${client.id})`);
      console.log(`  Balance: ${client.balance}, Profit Loss: ${client.profitLoss}, Credit Ref: ${client.creditRef}`);
    }

    // Check Account Transactions for profit/loss data
    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
    
    console.log('\n=== ACCOUNT TRANSACTIONS ===');
    
    // Casino settlements
    const casinoSettlements = await accountTransactionRepo.find({
      where: {
        type: 'settle-bet',
        remarks: 'CASINO-BET-SETTLED'
      },
      take: 10
    });
    
    console.log('Casino Settlements (sample):', casinoSettlements.length);
    for (const settlement of casinoSettlements.slice(0, 5)) {
      console.log(`- Amount: ${settlement.amount}, Type: ${settlement.type}, Downline: ${settlement.downlineUserId}`);
    }

    // Sports settlements
    const sportsSettlements = await accountTransactionRepo.find({
      where: [
        { type: 'deposit', remarks: 'SPORT-BET-SETTLED' },
        { type: 'withdraw', remarks: 'SPORT-BET-SETTLED' }
      ],
      take: 10
    });
    
    console.log('Sports Settlements (sample):', sportsSettlements.length);
    for (const settlement of sportsSettlements.slice(0, 5)) {
      console.log(`- Amount: ${settlement.amount}, Type: ${settlement.type}, Downline: ${settlement.downlineUserId}`);
    }

    // Check specific user transactions
    if (clients.length > 0) {
      const clientId = clients[0].id;
      console.log(`\n=== TRANSACTIONS FOR CLIENT ${clients[0].loginId} ===`);
      
      const clientTransactions = await accountTransactionRepo.find({
        where: { downlineUserId: clientId },
        take: 10
      });
      
      console.log('Client Transactions:', clientTransactions.length);
      for (const transaction of clientTransactions) {
        console.log(`- Amount: ${transaction.amount}, Type: ${transaction.type}, Remarks: ${transaction.remarks}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

checkDownlineData();
import { Admin } from './src/entities/users/AdminUser';
import { Client } from './src/entities/users/ClientUser';
import { AccountTrasaction } from './src/entities/Transactions/AccountTransactions';

// Database Configuration - only load specific entities
const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [TechAdmin, Admin, Client, AccountTrasaction],
  synchronize: false,
  logging: false,
});

async function checkDownlineData() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    // Get TechAdmin user
    const techAdminRepo = AppDataSource.getRepository(TechAdmin);
    const techAdmin = await techAdminRepo.findOne({
      where: { loginId: 'bluebet9Tech' }
    });

    if (!techAdmin) {
      console.log('TechAdmin not found');
      return;
    }

    console.log('\n=== TECHADMIN DATA ===');
    console.log('ID:', techAdmin.id);
    console.log('Login ID:', techAdmin.loginId);
    console.log('Balance:', techAdmin.balance);
    console.log('Profit Loss:', techAdmin.profitLoss);
    console.log('Credit Ref:', techAdmin.creditRef);

    // Get Admin users under this TechAdmin
    const adminRepo = AppDataSource.getRepository(Admin);
    const admins = await adminRepo.find({
      where: { uplineId: techAdmin.id }
    });

    console.log('\n=== ADMIN USERS ===');
    console.log('Count:', admins.length);
    for (const admin of admins) {
      console.log(`- Admin: ${admin.loginId} (ID: ${admin.id})`);
      console.log(`  Balance: ${admin.balance}, Profit Loss: ${admin.profitLoss}, Credit Ref: ${admin.creditRef}`);
    }

    // Get Client users under this TechAdmin (through all levels)
    const clientRepo = AppDataSource.getRepository(Client);
    const clients = await clientRepo.find({
      where: { uplineId: techAdmin.id }
    });

    console.log('\n=== CLIENT USERS ===');
    console.log('Count:', clients.length);
    for (const client of clients) {
      console.log(`- Client: ${client.loginId} (ID: ${client.id})`);
      console.log(`  Balance: ${client.balance}, Profit Loss: ${client.profitLoss}, Credit Ref: ${client.creditRef}`);
    }

    // Check Account Transactions for profit/loss data
    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
    
    console.log('\n=== ACCOUNT TRANSACTIONS ===');
    
    // Casino settlements
    const casinoSettlements = await accountTransactionRepo.find({
      where: {
        type: 'settle-bet',
        remarks: 'CASINO-BET-SETTLED'
      },
      take: 10
    });
    
    console.log('Casino Settlements (sample):', casinoSettlements.length);
    for (const settlement of casinoSettlements.slice(0, 5)) {
      console.log(`- Amount: ${settlement.amount}, Type: ${settlement.type}, Downline: ${settlement.downlineUserId}`);
    }

    // Sports settlements
    const sportsSettlements = await accountTransactionRepo.find({
      where: [
        { type: 'deposit', remarks: 'SPORT-BET-SETTLED' },
        { type: 'withdraw', remarks: 'SPORT-BET-SETTLED' }
      ],
      take: 10
    });
    
    console.log('Sports Settlements (sample):', sportsSettlements.length);
    for (const settlement of sportsSettlements.slice(0, 5)) {
      console.log(`- Amount: ${settlement.amount}, Type: ${settlement.type}, Downline: ${settlement.downlineUserId}`);
    }

    // Check specific user transactions
    if (clients.length > 0) {
      const clientId = clients[0].id;
      console.log(`\n=== TRANSACTIONS FOR CLIENT ${clients[0].loginId} ===`);
      
      const clientTransactions = await accountTransactionRepo.find({
        where: { downlineUserId: clientId },
        take: 10
      });
      
      console.log('Client Transactions:', clientTransactions.length);
      for (const transaction of clientTransactions) {
        console.log(`- Amount: ${transaction.amount}, Type: ${transaction.type}, Remarks: ${transaction.remarks}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

checkDownlineData();





