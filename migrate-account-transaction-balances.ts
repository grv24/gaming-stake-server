import { AppDataSource } from './src/server';
import { AccountTrasaction } from './src/entities/Transactions/AccountTransactions';

/**
 * Migration script to add balance field to existing AccountTransaction records
 * This script calculates the balance for existing transactions based on their type and amount
 */
async function migrateAccountTransactionBalances() {
  try {
    console.log('Starting AccountTransaction balance migration...');
    
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database initialized');
    }

    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
    
    // Get all transactions ordered by user and date
    const transactions = await accountTransactionRepo.find({
      order: {
        downlineUserId: 'ASC',
        createdAt: 'ASC'
      }
    });

    console.log(`Found ${transactions.length} transactions to migrate`);

    // Group transactions by user
    const userTransactions = new Map<string, AccountTrasaction[]>();
    
    for (const tx of transactions) {
      const userId = tx.downlineUserId;
      if (!userTransactions.has(userId)) {
        userTransactions.set(userId, []);
      }
      userTransactions.get(userId)!.push(tx);
    }

    console.log(`Processing ${userTransactions.size} users`);

    // Calculate balance for each user's transactions
    for (const [userId, userTxs] of userTransactions) {
      let runningBalance = 0;
      
      for (const tx of userTxs) {
        // Calculate balance based on transaction type
        if (tx.type === 'deposit') {
          runningBalance += tx.amount;
        } else if (tx.type === 'withdraw') {
          runningBalance -= tx.amount;
        }
        // For casino/sports settlements, the balance is already calculated in the transaction
        
        // Update the transaction with the calculated balance
        await accountTransactionRepo.update(tx.id, {
          balance: runningBalance
        });
        
        console.log(`Updated transaction ${tx.id} for user ${userId}: balance = ${runningBalance}`);
      }
    }

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
migrateAccountTransactionBalances();

/**
 * Migration script to add balance field to existing AccountTransaction records
 * This script calculates the balance for existing transactions based on their type and amount
 */
async function migrateAccountTransactionBalances() {
  try {
    console.log('Starting AccountTransaction balance migration...');
    
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database initialized');
    }

    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
    
    // Get all transactions ordered by user and date
    const transactions = await accountTransactionRepo.find({
      order: {
        downlineUserId: 'ASC',
        createdAt: 'ASC'
      }
    });

    console.log(`Found ${transactions.length} transactions to migrate`);

    // Group transactions by user
    const userTransactions = new Map<string, AccountTrasaction[]>();
    
    for (const tx of transactions) {
      const userId = tx.downlineUserId;
      if (!userTransactions.has(userId)) {
        userTransactions.set(userId, []);
      }
      userTransactions.get(userId)!.push(tx);
    }

    console.log(`Processing ${userTransactions.size} users`);

    // Calculate balance for each user's transactions
    for (const [userId, userTxs] of userTransactions) {
      let runningBalance = 0;
      
      for (const tx of userTxs) {
        // Calculate balance based on transaction type
        if (tx.type === 'deposit') {
          runningBalance += tx.amount;
        } else if (tx.type === 'withdraw') {
          runningBalance -= tx.amount;
        }
        // For casino/sports settlements, the balance is already calculated in the transaction
        
        // Update the transaction with the calculated balance
        await accountTransactionRepo.update(tx.id, {
          balance: runningBalance
        });
        
        console.log(`Updated transaction ${tx.id} for user ${userId}: balance = ${runningBalance}`);
      }
    }

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
migrateAccountTransactionBalances();
