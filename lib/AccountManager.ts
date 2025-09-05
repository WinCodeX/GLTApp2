// lib/AccountManager.ts - Centralized account data management
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface AccountData {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  token: string;
  role: 'admin' | 'client';
  userData: any; // Full user object from server
  lastUsed: number;
  createdAt: number;
}

export interface AccountGroup {
  accounts: AccountData[];
  currentAccountId: string | null;
  version: number; // For data migration
}

const STORAGE_KEY = 'account_groups';
const CURRENT_ACCOUNT_KEY = 'current_account_id';

export class AccountManager {
  private static instance: AccountManager;
  private accountGroup: AccountGroup = {
    accounts: [],
    currentAccountId: null,
    version: 1
  };

  private constructor() {}

  static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }
    return AccountManager.instance;
  }

  // Initialize - load from storage
  async initialize(): Promise<void> {
    try {
      console.log('🔧 AccountManager: Initializing...');
      
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);
      const currentAccountId = await AsyncStorage.getItem(CURRENT_ACCOUNT_KEY);
      
      if (storedData) {
        const parsed = JSON.parse(storedData);
        this.accountGroup = {
          accounts: parsed.accounts || [],
          currentAccountId: currentAccountId || parsed.currentAccountId || null,
          version: parsed.version || 1
        };
        
        console.log('✅ AccountManager: Loaded', {
          accounts: this.accountGroup.accounts.length,
          current: this.accountGroup.currentAccountId
        });
      }
    } catch (error) {
      console.error('❌ AccountManager: Failed to initialize:', error);
      this.accountGroup = { accounts: [], currentAccountId: null, version: 1 };
    }
  }

  // Save to storage with proper type handling
  private async persist(): Promise<void> {
    try {
      // Ensure all data is properly serialized as strings
      const dataToStore = {
        accounts: this.accountGroup.accounts.map(account => ({
          ...account,
          lastUsed: String(account.lastUsed),
          createdAt: String(account.createdAt)
        })),
        currentAccountId: this.accountGroup.currentAccountId,
        version: String(this.accountGroup.version)
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
      
      if (this.accountGroup.currentAccountId) {
        await AsyncStorage.setItem(CURRENT_ACCOUNT_KEY, String(this.accountGroup.currentAccountId));
      }
      
      console.log('💾 AccountManager: Data persisted');
    } catch (error) {
      console.error('❌ AccountManager: Failed to persist:', error);
      throw error;
    }
  }

  // Add new account
  async addAccount(userData: any, token: string): Promise<void> {
    try {
      console.log('➕ AccountManager: Adding account:', userData.email);
      
      // Check if account already exists
      const existingIndex = this.accountGroup.accounts.findIndex(acc => acc.id === userData.id);
      
      const roles = userData.roles || [];
      const role = roles.includes('admin') ? 'admin' : 'client';
      
      const accountData: AccountData = {
        id: String(userData.id),
        email: String(userData.email),
        display_name: String(userData.display_name || userData.first_name || userData.email),
        avatar_url: userData.avatar_url,
        token: String(token),
        role: role,
        userData: userData,
        lastUsed: Date.now(),
        createdAt: existingIndex !== -1 ? this.accountGroup.accounts[existingIndex].createdAt : Date.now()
      };

      if (existingIndex !== -1) {
        // Update existing account
        this.accountGroup.accounts[existingIndex] = accountData;
        console.log('🔄 AccountManager: Updated existing account');
      } else {
        // Add new account
        if (this.accountGroup.accounts.length >= 3) {
          throw new Error('Maximum of 3 accounts allowed');
        }
        this.accountGroup.accounts.push(accountData);
        console.log('✅ AccountManager: Added new account');
      }

      // Set as current account
      await this.setCurrentAccount(String(userData.id));
      await this.persist();
      
    } catch (error) {
      console.error('❌ AccountManager: Failed to add account:', error);
      throw error;
    }
  }

  // Set current account
  async setCurrentAccount(accountId: string): Promise<void> {
    const account = this.accountGroup.accounts.find(acc => acc.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    console.log('🔄 AccountManager: Setting current account:', account.email);
    
    // Update last used timestamp
    account.lastUsed = Date.now();
    this.accountGroup.currentAccountId = accountId;
    
    // Update SecureStore with current account's auth data - ensure all values are strings
    await SecureStore.setItemAsync('auth_token', String(account.token || ''));
    await SecureStore.setItemAsync('user_id', String(account.id || ''));
    await SecureStore.setItemAsync('user_role', String(account.role || ''));
    
    await this.persist();
    console.log('✅ AccountManager: Current account set');
  }

  // Get current account
  getCurrentAccount(): AccountData | null {
    if (!this.accountGroup.currentAccountId) return null;
    
    return this.accountGroup.accounts.find(
      acc => acc.id === this.accountGroup.currentAccountId
    ) || null;
  }

  // Get all accounts
  getAllAccounts(): AccountData[] {
    return [...this.accountGroup.accounts];
  }

  // Remove account
  async removeAccount(accountId: string): Promise<void> {
    console.log('🗑️ AccountManager: Removing account:', accountId);
    
    const accountIndex = this.accountGroup.accounts.findIndex(acc => acc.id === accountId);
    if (accountIndex === -1) {
      throw new Error('Account not found');
    }

    const removedAccount = this.accountGroup.accounts[accountIndex];
    this.accountGroup.accounts.splice(accountIndex, 1);

    // If this was the current account, switch to another or clear
    if (this.accountGroup.currentAccountId === accountId) {
      if (this.accountGroup.accounts.length > 0) {
        // Switch to most recently used account
        const mostRecent = this.accountGroup.accounts.reduce((prev, current) => 
          (prev.lastUsed > current.lastUsed) ? prev : current
        );
        await this.setCurrentAccount(mostRecent.id);
      } else {
        // No accounts left
        await this.clearAllAccounts();
      }
    }

    await this.persist();
    console.log('✅ AccountManager: Account removed:', removedAccount.email);
  }

  // Update account data (e.g., after API refresh)
  async updateAccount(accountId: string, userData: any): Promise<void> {
    const accountIndex = this.accountGroup.accounts.findIndex(acc => acc.id === accountId);
    if (accountIndex === -1) return;

    const account = this.accountGroup.accounts[accountIndex];
    account.userData = userData;
    account.display_name = String(userData.display_name || userData.first_name || userData.email);
    account.avatar_url = userData.avatar_url;
    account.lastUsed = Date.now();

    await this.persist();
    console.log('✅ AccountManager: Account updated:', account.email);
  }

  // Clear all accounts (logout)
  async clearAllAccounts(): Promise<void> {
    console.log('🧹 AccountManager: Clearing all accounts');
    
    this.accountGroup = { accounts: [], currentAccountId: null, version: 1 };
    
    // Clear SecureStore
    await SecureStore.deleteItemAsync('auth_token').catch(() => {});
    await SecureStore.deleteItemAsync('user_id').catch(() => {});
    await SecureStore.deleteItemAsync('user_role').catch(() => {});
    
    // Clear AsyncStorage
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(CURRENT_ACCOUNT_KEY);
    
    console.log('✅ AccountManager: All accounts cleared');
  }

  // Get current account's auth token
  getCurrentToken(): string | null {
    const current = this.getCurrentAccount();
    return current?.token || null;
  }

  // Get current account's user ID
  getCurrentUserId(): string | null {
    const current = this.getCurrentAccount();
    return current?.id || null;
  }

  // Get current account's role
  getCurrentRole(): string | null {
    const current = this.getCurrentAccount();
    return current?.role || null;
  }

  // Get current account's user data
  getCurrentUserData(): any | null {
    const current = this.getCurrentAccount();
    return current?.userData || null;
  }

  // Check if has any accounts
  hasAccounts(): boolean {
    return this.accountGroup.accounts.length > 0;
  }

  // Check if account exists
  hasAccount(accountId: string): boolean {
    return this.accountGroup.accounts.some(acc => acc.id === accountId);
  }
}

// Export singleton instance
export const accountManager = AccountManager.getInstance();