// lib/AccountManager.ts - Fixed with updateAccountRole method and support role
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface AccountData {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  token: string;
  role: 'admin' | 'client' | 'support'; // FIXED: Added support role
  userData: any; // Full user object from server
  lastUsed: number;
  createdAt: number;
}

export interface AccountGroup {
  accounts: AccountData[];
  currentAccountId: string | null;
  version: number; // For data migration
}

// Storage keys
const STORAGE_KEY = 'account_groups';
const CURRENT_ACCOUNT_KEY = 'current_account_id';
const BACKUP_KEY = 'account_groups_backup';

// Storage schema version for migrations
const CURRENT_VERSION = 2;

export class AccountManager {
  private static instance: AccountManager;
  private accountGroup: AccountGroup = {
    accounts: [],
    currentAccountId: null,
    version: CURRENT_VERSION
  };
  private initialized = false;
  private persistenceTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }
    return AccountManager.instance;
  }

  // Robust initialization with data validation and recovery
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('AccountManager: Already initialized');
      return;
    }

    try {
      console.log('AccountManager: Starting initialization...');
      
      // Try to load main data
      const mainData = await this.loadStoredData(STORAGE_KEY);
      const currentAccountId = await this.loadCurrentAccountId();
      
      if (mainData && this.validateAccountGroup(mainData)) {
        // Successfully loaded valid data
        this.accountGroup = {
          accounts: mainData.accounts,
          currentAccountId: currentAccountId || mainData.currentAccountId || null,
          version: mainData.version || CURRENT_VERSION
        };
        
        console.log('AccountManager: Loaded from main storage', {
          accounts: this.accountGroup.accounts.length,
          current: this.accountGroup.currentAccountId
        });
      } else if (mainData && !this.validateAccountGroup(mainData)) {
        // Data exists but is invalid - try backup
        console.warn('AccountManager: Main data invalid, trying backup...');
        const backupData = await this.loadStoredData(BACKUP_KEY);
        
        if (backupData && this.validateAccountGroup(backupData)) {
          this.accountGroup = {
            accounts: backupData.accounts,
            currentAccountId: currentAccountId || backupData.currentAccountId || null,
            version: backupData.version || CURRENT_VERSION
          };
          
          // Restore main storage from backup
          await this.persist();
          console.log('AccountManager: Restored from backup');
        } else {
          // Both main and backup failed
          console.error('AccountManager: Both main and backup data invalid, starting fresh');
          await this.resetToDefaults();
        }
      } else {
        // No data found - fresh start
        console.log('AccountManager: No stored data, starting fresh');
        await this.resetToDefaults();
      }

      // Perform data migration if needed
      await this.migrateIfNeeded();
      
      // Sync with SecureStore if we have a current account
      await this.syncWithSecureStore();
      
      this.initialized = true;
      console.log('AccountManager: Initialization complete');
      
    } catch (error) {
      console.error('AccountManager: Critical initialization error:', error);
      await this.resetToDefaults();
      this.initialized = true;
    }
  }

  // Robust data loading with proper type conversion
  private async loadStoredData(key: string): Promise<AccountGroup | null> {
    try {
      const storedData = await AsyncStorage.getItem(key);
      if (!storedData) return null;
      
      const parsed = JSON.parse(storedData);
      
      // Convert stored data back to proper types
      const accountGroup: AccountGroup = {
        accounts: (parsed.accounts || []).map((account: any) => ({
          id: String(account.id || ''),
          email: String(account.email || ''),
          display_name: String(account.display_name || account.email || ''),
          avatar_url: account.avatar_url || null,
          token: String(account.token || ''),
          role: this.validateRole(account.role), // FIXED: Proper role validation
          userData: account.userData || {},
          lastUsed: this.parseTimestamp(account.lastUsed),
          createdAt: this.parseTimestamp(account.createdAt)
        })).filter((account: AccountData) => 
          // Filter out invalid accounts
          account.id && account.email && account.token
        ),
        currentAccountId: parsed.currentAccountId || null,
        version: parseInt(parsed.version) || 1
      };
      
      return accountGroup;
    } catch (error) {
      console.error(`AccountManager: Failed to load from ${key}:`, error);
      return null;
    }
  }

  // FIXED: Validate and sanitize role values
  private validateRole(role: any): 'admin' | 'client' | 'support' {
    if (role === 'admin' || role === 'support' || role === 'client') {
      return role;
    }
    console.warn('AccountManager: Invalid role found, defaulting to client:', role);
    return 'client';
  }

  // Helper to safely parse timestamps
  private parseTimestamp(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value);
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  }

  // Load current account ID separately for better reliability
  private async loadCurrentAccountId(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(CURRENT_ACCOUNT_KEY);
      return stored ? String(stored) : null;
    } catch (error) {
      console.error('AccountManager: Failed to load current account ID:', error);
      return null;
    }
  }

  // Comprehensive data validation
  private validateAccountGroup(data: any): boolean {
    if (!data || typeof data !== 'object') {
      console.warn('AccountManager: Data is not an object');
      return false;
    }
    
    if (!Array.isArray(data.accounts)) {
      console.warn('AccountManager: Accounts is not an array');
      return false;
    }
    
    // Validate each account
    for (const account of data.accounts) {
      if (!this.validateAccount(account)) {
        console.warn('AccountManager: Invalid account found:', account?.email || 'unknown');
        return false;
      }
    }
    
    console.log('AccountManager: Data validation passed');
    return true;
  }

  // Validate individual account
  private validateAccount(account: any): boolean {
    return !!(
      account &&
      account.id &&
      account.email &&
      account.token &&
      account.display_name &&
      (account.role === 'admin' || account.role === 'client' || account.role === 'support') &&
      account.lastUsed &&
      account.createdAt
    );
  }

  // Reset to default state
  private async resetToDefaults(): Promise<void> {
    this.accountGroup = {
      accounts: [],
      currentAccountId: null,
      version: CURRENT_VERSION
    };
    await this.clearAllStorage();
  }

  // Robust persistence with backup and error recovery
  private async persist(): Promise<void> {
    // Clear any existing timeout
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    // Debounce persistence calls
    this.persistenceTimeout = setTimeout(async () => {
      try {
        console.log('AccountManager: Starting persistence...');
        
        // Create backup of current data first
        await this.createBackup();
        
        // Prepare data for storage with proper type conversion
        const dataToStore = {
          accounts: this.accountGroup.accounts.map(account => ({
            id: String(account.id),
            email: String(account.email),
            display_name: String(account.display_name),
            avatar_url: account.avatar_url,
            token: String(account.token),
            role: String(account.role),
            userData: account.userData,
            lastUsed: String(account.lastUsed),
            createdAt: String(account.createdAt)
          })),
          currentAccountId: this.accountGroup.currentAccountId ? String(this.accountGroup.currentAccountId) : null,
          version: String(CURRENT_VERSION),
          persistedAt: String(Date.now())
        };

        // Store main data
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
        
        // Store current account ID separately for quick access
        if (this.accountGroup.currentAccountId) {
          await AsyncStorage.setItem(CURRENT_ACCOUNT_KEY, String(this.accountGroup.currentAccountId));
        } else {
          await AsyncStorage.removeItem(CURRENT_ACCOUNT_KEY);
        }
        
        // Update SecureStore
        await this.syncWithSecureStore();
        
        console.log('AccountManager: Persistence successful', {
          accounts: this.accountGroup.accounts.length,
          currentId: this.accountGroup.currentAccountId
        });
        
      } catch (error) {
        console.error('AccountManager: Persistence failed:', error);
        
        // Try to restore from backup if persistence fails
        try {
          await this.restoreFromBackup();
          console.log('AccountManager: Restored from backup after persistence failure');
        } catch (backupError) {
          console.error('AccountManager: Backup restoration also failed:', backupError);
        }
        
        throw error;
      }
    }, 100);
  }

  // Create backup of current data
  private async createBackup(): Promise<void> {
    try {
      const currentData = await AsyncStorage.getItem(STORAGE_KEY);
      if (currentData) {
        await AsyncStorage.setItem(BACKUP_KEY, currentData);
      }
    } catch (error) {
      console.warn('AccountManager: Failed to create backup:', error);
    }
  }

  // Restore from backup
  private async restoreFromBackup(): Promise<void> {
    const backupData = await this.loadStoredData(BACKUP_KEY);
    if (backupData && this.validateAccountGroup(backupData)) {
      this.accountGroup = backupData;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(backupData));
    }
  }

  // Enhanced account addition with better validation
  async addAccount(userData: any, token: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('AccountManager: Adding account:', userData?.email || 'unknown email');
      
      // Validate input data
      if (!userData || !userData.id || !userData.email || !token) {
        throw new Error('Invalid account data or token');
      }
      
      // Check if account already exists
      const existingIndex = this.accountGroup.accounts.findIndex(acc => acc.id === String(userData.id));
      
      // FIXED: Proper role determination that handles support role
      const roles = userData.roles || [];
      let role: 'admin' | 'client' | 'support' = 'client';
      
      if (userData.primary_role && userData.primary_role !== 'client') {
        role = this.validateRole(userData.primary_role);
      } else if (roles.includes('admin')) {
        role = 'admin';
      } else if (roles.includes('support')) {
        role = 'support';
      }
      
      const accountData: AccountData = {
        id: String(userData.id),
        email: String(userData.email),
        display_name: String(userData.display_name || userData.first_name || userData.email),
        avatar_url: userData.avatar_url || null,
        token: String(token),
        role: role,
        userData: userData,
        lastUsed: Date.now(),
        createdAt: existingIndex !== -1 ? this.accountGroup.accounts[existingIndex].createdAt : Date.now()
      };

      if (existingIndex !== -1) {
        // Update existing account
        this.accountGroup.accounts[existingIndex] = accountData;
        console.log('AccountManager: Updated existing account');
      } else {
        // Add new account
        if (this.accountGroup.accounts.length >= 3) {
          throw new Error('Maximum of 3 accounts allowed');
        }
        this.accountGroup.accounts.push(accountData);
        console.log('AccountManager: Added new account');
      }

      // Set as current account
      await this.setCurrentAccount(String(userData.id));
      
    } catch (error) {
      console.error('AccountManager: Failed to add account:', error);
      throw error;
    }
  }

  // FIXED: Add the missing updateAccountRole method
  async updateAccountRole(accountId: string, newRole: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('AccountManager: Updating account role:', { accountId, newRole });
      
      const accountIndex = this.accountGroup.accounts.findIndex(acc => acc.id === accountId);
      if (accountIndex === -1) {
        throw new Error(`Account not found: ${accountId}`);
      }

      const validatedRole = this.validateRole(newRole);
      const account = this.accountGroup.accounts[accountIndex];
      
      // Update the role
      account.role = validatedRole;
      account.lastUsed = Date.now();
      
      // Persist changes
      await this.persist();
      
      console.log('AccountManager: Account role updated successfully:', {
        email: account.email,
        oldRole: account.role,
        newRole: validatedRole
      });
      
    } catch (error) {
      console.error('AccountManager: Failed to update account role:', error);
      throw error;
    }
  }

  // Enhanced current account setting with validation
  async setCurrentAccount(accountId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const account = this.accountGroup.accounts.find(acc => acc.id === accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    console.log('AccountManager: Setting current account:', account.email);
    
    try {
      // Update last used timestamp
      account.lastUsed = Date.now();
      this.accountGroup.currentAccountId = accountId;
      
      // Persist changes
      await this.persist();
      
      console.log('AccountManager: Current account set successfully');
      
    } catch (error) {
      console.error('AccountManager: Failed to set current account:', error);
      throw error;
    }
  }

  // Secure sync with SecureStore
  private async syncWithSecureStore(): Promise<void> {
    try {
      const currentAccount = this.getCurrentAccount();
      
      if (currentAccount) {
        // Set current account's auth data
        await SecureStore.setItemAsync('auth_token', String(currentAccount.token));
        await SecureStore.setItemAsync('user_id', String(currentAccount.id));
        await SecureStore.setItemAsync('user_role', String(currentAccount.role));
        console.log('AccountManager: SecureStore synced with current account');
      } else {
        // Clear SecureStore if no current account
        await SecureStore.deleteItemAsync('auth_token').catch(() => {});
        await SecureStore.deleteItemAsync('user_id').catch(() => {});
        await SecureStore.deleteItemAsync('user_role').catch(() => {});
        console.log('AccountManager: SecureStore cleared');
      }
    } catch (error) {
      console.error('AccountManager: SecureStore sync failed:', error);
    }
  }

  // Data migration for version updates
  private async migrateIfNeeded(): Promise<void> {
    if (this.accountGroup.version < CURRENT_VERSION) {
      console.log(`AccountManager: Migrating from v${this.accountGroup.version} to v${CURRENT_VERSION}`);
      
      // Add migration logic here as needed
      if (this.accountGroup.version === 1) {
        // Example migration: ensure all timestamps are numbers and validate roles
        this.accountGroup.accounts = this.accountGroup.accounts.map(account => ({
          ...account,
          role: this.validateRole(account.role), // Ensure valid role
          lastUsed: this.parseTimestamp(account.lastUsed),
          createdAt: this.parseTimestamp(account.createdAt)
        }));
      }
      
      this.accountGroup.version = CURRENT_VERSION;
      await this.persist();
      console.log('AccountManager: Migration completed');
    }
  }

  // Get current account with validation
  getCurrentAccount(): AccountData | null {
    if (!this.accountGroup.currentAccountId) return null;
    
    const account = this.accountGroup.accounts.find(
      acc => acc.id === this.accountGroup.currentAccountId
    );
    
    // Validate account before returning
    if (account && this.validateAccount(account)) {
      return account;
    }
    
    // Current account is invalid, clear it
    if (account) {
      console.warn('AccountManager: Current account is invalid, clearing');
      this.accountGroup.currentAccountId = null;
      this.persist().catch(() => {}); // Don't await to avoid blocking
    }
    
    return null;
  }

  // Get all accounts
  getAllAccounts(): AccountData[] {
    return this.accountGroup.accounts.filter(account => this.validateAccount(account));
  }

  // Enhanced account removal with cleanup
  async removeAccount(accountId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log('AccountManager: Removing account:', accountId);
    
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
        return; // clearAllAccounts handles persistence
      }
    }

    await this.persist();
    console.log('AccountManager: Account removed:', removedAccount.email);
  }

  // Update account data (e.g., after API refresh)
  async updateAccount(accountId: string, userData: any): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const accountIndex = this.accountGroup.accounts.findIndex(acc => acc.id === accountId);
    if (accountIndex === -1) return;

    const account = this.accountGroup.accounts[accountIndex];
    account.userData = userData;
    account.display_name = String(userData.display_name || userData.first_name || userData.email);
    account.avatar_url = userData.avatar_url;
    account.lastUsed = Date.now();

    await this.persist();
    console.log('AccountManager: Account updated:', account.email);
  }

  // Complete cleanup with error handling
  async clearAllAccounts(): Promise<void> {
    console.log('AccountManager: Clearing all accounts');
    
    this.accountGroup = { 
      accounts: [], 
      currentAccountId: null, 
      version: CURRENT_VERSION 
    };
    
    await this.clearAllStorage();
    console.log('AccountManager: All accounts cleared');
  }

  // Clear all storage locations
  private async clearAllStorage(): Promise<void> {
    try {
      // Clear SecureStore
      await Promise.all([
        SecureStore.deleteItemAsync('auth_token').catch(() => {}),
        SecureStore.deleteItemAsync('user_id').catch(() => {}),
        SecureStore.deleteItemAsync('user_role').catch(() => {})
      ]);
      
      // Clear AsyncStorage
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY),
        AsyncStorage.removeItem(CURRENT_ACCOUNT_KEY),
        AsyncStorage.removeItem(BACKUP_KEY)
      ]);
      
    } catch (error) {
      console.error('AccountManager: Failed to clear storage:', error);
    }
  }

  // Robust token retrieval with validation
  getCurrentToken(): string | null {
    const current = this.getCurrentAccount();
    const token = current?.token;
    
    if (token && token.length > 0) {
      return token;
    }
    
    console.warn('AccountManager: No valid token available');
    return null;
  }

  // Get current account's user ID
  getCurrentUserId(): string | null {
    const current = this.getCurrentAccount();
    const userId = current?.id;
    
    if (userId && userId.length > 0) {
      return userId;
    }
    
    console.warn('AccountManager: No valid user ID available');
    return null;
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

  // Debug method to check account manager state
  getDebugInfo(): any {
    return {
      initialized: this.initialized,
      accountCount: this.accountGroup.accounts.length,
      currentAccountId: this.accountGroup.currentAccountId,
      hasCurrentAccount: !!this.getCurrentAccount(),
      currentToken: !!this.getCurrentToken(),
      currentUserId: this.getCurrentUserId(),
      currentRole: this.getCurrentRole(),
      accounts: this.accountGroup.accounts.map(acc => ({
        id: acc.id,
        email: acc.email,
        role: acc.role,
        hasToken: !!acc.token,
        lastUsed: new Date(acc.lastUsed).toISOString()
      }))
    };
  }

  // Force re-initialization (useful for debugging)
  async forceReinitialize(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }
}

// Export singleton instance
export const accountManager = AccountManager.getInstance();