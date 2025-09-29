// lib/AccountManager.ts - FIXED: Immediate persistence + better role handling
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface AccountData {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  token: string;
  role: 'admin' | 'client' | 'support';
  userData: any;
  lastUsed: number;
  createdAt: number;
}

export interface AccountGroup {
  accounts: AccountData[];
  currentAccountId: string | null;
  version: number;
}

const STORAGE_KEY = 'account_groups';
const CURRENT_ACCOUNT_KEY = 'current_account_id';
const BACKUP_KEY = 'account_groups_backup';
const CURRENT_VERSION = 2;

export class AccountManager {
  private static instance: AccountManager;
  private accountGroup: AccountGroup = {
    accounts: [],
    currentAccountId: null,
    version: CURRENT_VERSION
  };
  private initialized = false;

  private constructor() {}

  static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }
    return AccountManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('AccountManager: Already initialized');
      return;
    }

    try {
      console.log('AccountManager: Starting initialization...');
      
      const mainData = await this.loadStoredData(STORAGE_KEY);
      const currentAccountId = await this.loadCurrentAccountId();
      
      if (mainData && this.validateAccountGroup(mainData)) {
        this.accountGroup = {
          accounts: mainData.accounts,
          currentAccountId: currentAccountId || mainData.currentAccountId || null,
          version: mainData.version || CURRENT_VERSION
        };
        
        console.log('AccountManager: Loaded accounts:', {
          count: this.accountGroup.accounts.length,
          current: this.accountGroup.currentAccountId,
          roles: this.accountGroup.accounts.map(a => ({ email: a.email, role: a.role }))
        });
      } else if (mainData && !this.validateAccountGroup(mainData)) {
        console.warn('AccountManager: Main data invalid, trying backup...');
        const backupData = await this.loadStoredData(BACKUP_KEY);
        
        if (backupData && this.validateAccountGroup(backupData)) {
          this.accountGroup = {
            accounts: backupData.accounts,
            currentAccountId: currentAccountId || backupData.currentAccountId || null,
            version: backupData.version || CURRENT_VERSION
          };
          await this.persistImmediate(); // Use immediate persist
          console.log('AccountManager: Restored from backup');
        } else {
          console.error('AccountManager: Both main and backup invalid, resetting');
          await this.resetToDefaults();
        }
      } else {
        console.log('AccountManager: No stored data, starting fresh');
        await this.resetToDefaults();
      }

      await this.migrateIfNeeded();
      await this.syncWithSecureStore();
      
      this.initialized = true;
      console.log('AccountManager: Initialization complete');
      
    } catch (error) {
      console.error('AccountManager: Critical initialization error:', error);
      await this.resetToDefaults();
      this.initialized = true;
    }
  }

  private async loadStoredData(key: string): Promise<AccountGroup | null> {
    try {
      const storedData = await AsyncStorage.getItem(key);
      if (!storedData) return null;
      
      const parsed = JSON.parse(storedData);
      
      const accountGroup: AccountGroup = {
        accounts: (parsed.accounts || []).map((account: any) => ({
          id: String(account.id || ''),
          email: String(account.email || ''),
          display_name: String(account.display_name || account.email || ''),
          avatar_url: account.avatar_url || null,
          token: String(account.token || ''),
          role: this.validateRole(account.role),
          userData: account.userData || {},
          lastUsed: this.parseTimestamp(account.lastUsed),
          createdAt: this.parseTimestamp(account.createdAt)
        })).filter((account: AccountData) => 
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

  private validateRole(role: any): 'admin' | 'client' | 'support' {
    if (role === 'admin' || role === 'support' || role === 'client') {
      return role;
    }
    console.warn('AccountManager: Invalid role, defaulting to client:', role);
    return 'client';
  }

  private parseTimestamp(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value);
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  }

  private async loadCurrentAccountId(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(CURRENT_ACCOUNT_KEY);
      return stored ? String(stored) : null;
    } catch (error) {
      console.error('AccountManager: Failed to load current account ID:', error);
      return null;
    }
  }

  private validateAccountGroup(data: any): boolean {
    if (!data || typeof data !== 'object' || !Array.isArray(data.accounts)) {
      return false;
    }
    
    for (const account of data.accounts) {
      if (!this.validateAccount(account)) {
        return false;
      }
    }
    
    return true;
  }

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

  private async resetToDefaults(): Promise<void> {
    this.accountGroup = {
      accounts: [],
      currentAccountId: null,
      version: CURRENT_VERSION
    };
    await this.clearAllStorage();
  }

  // FIXED: Immediate persist without debounce for critical operations
  private async persistImmediate(): Promise<void> {
    try {
      console.log('AccountManager: Starting immediate persistence...');
      
      await this.createBackup();
      
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

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
      
      if (this.accountGroup.currentAccountId) {
        await AsyncStorage.setItem(CURRENT_ACCOUNT_KEY, String(this.accountGroup.currentAccountId));
      } else {
        await AsyncStorage.removeItem(CURRENT_ACCOUNT_KEY);
      }
      
      await this.syncWithSecureStore();
      
      console.log('AccountManager: Immediate persistence successful', {
        accounts: this.accountGroup.accounts.length,
        currentId: this.accountGroup.currentAccountId,
        roles: this.accountGroup.accounts.map(a => ({ email: a.email, role: a.role }))
      });
      
    } catch (error) {
      console.error('AccountManager: Immediate persistence failed:', error);
      throw error;
    }
  }

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

  // FIXED: Enhanced addAccount with immediate persistence and better logging
  async addAccount(userData: any, token: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('AccountManager: Adding account:', {
        email: userData?.email,
        id: userData?.id,
        primary_role: userData?.primary_role,
        roles: userData?.roles
      });
      
      if (!userData || !userData.id || !userData.email || !token) {
        throw new Error('Invalid account data or token');
      }
      
      const existingIndex = this.accountGroup.accounts.findIndex(acc => acc.id === String(userData.id));
      
      // FIXED: Determine role with priority: primary_role > roles array
      const roles = userData.roles || [];
      let role: 'admin' | 'client' | 'support' = 'client';
      
      if (userData.primary_role && userData.primary_role !== 'client') {
        role = this.validateRole(userData.primary_role);
        console.log('AccountManager: Using primary_role:', role);
      } else if (roles.includes('admin')) {
        role = 'admin';
        console.log('AccountManager: Found admin in roles array');
      } else if (roles.includes('support')) {
        role = 'support';
        console.log('AccountManager: Found support in roles array');
      } else if (userData.role && userData.role !== 'client') {
        role = this.validateRole(userData.role);
        console.log('AccountManager: Using role field:', role);
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
        this.accountGroup.accounts[existingIndex] = accountData;
        console.log('AccountManager: Updated existing account with role:', role);
      } else {
        if (this.accountGroup.accounts.length >= 3) {
          throw new Error('Maximum of 3 accounts allowed');
        }
        this.accountGroup.accounts.push(accountData);
        console.log('AccountManager: Added new account with role:', role);
      }

      await this.setCurrentAccount(String(userData.id));
      
      console.log('AccountManager: Account saved successfully:', {
        email: accountData.email,
        role: accountData.role,
        id: accountData.id
      });
      
    } catch (error) {
      console.error('AccountManager: Failed to add account:', error);
      throw error;
    }
  }

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
      
      account.role = validatedRole;
      account.lastUsed = Date.now();
      
      await this.persistImmediate(); // Use immediate persist
      
      console.log('AccountManager: Account role updated:', {
        email: account.email,
        newRole: validatedRole
      });
      
    } catch (error) {
      console.error('AccountManager: Failed to update account role:', error);
      throw error;
    }
  }

  async setCurrentAccount(accountId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const account = this.accountGroup.accounts.find(acc => acc.id === accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    console.log('AccountManager: Setting current account:', {
      email: account.email,
      role: account.role
    });
    
    try {
      account.lastUsed = Date.now();
      this.accountGroup.currentAccountId = accountId;
      
      await this.persistImmediate(); // FIXED: Use immediate persist
      
      console.log('AccountManager: Current account set:', {
        id: accountId,
        role: account.role
      });
      
    } catch (error) {
      console.error('AccountManager: Failed to set current account:', error);
      throw error;
    }
  }

  private async syncWithSecureStore(): Promise<void> {
    try {
      const currentAccount = this.getCurrentAccount();
      
      if (currentAccount) {
        await SecureStore.setItemAsync('auth_token', String(currentAccount.token));
        await SecureStore.setItemAsync('user_id', String(currentAccount.id));
        await SecureStore.setItemAsync('user_role', String(currentAccount.role));
        console.log('AccountManager: SecureStore synced:', {
          userId: currentAccount.id,
          role: currentAccount.role
        });
      } else {
        await SecureStore.deleteItemAsync('auth_token').catch(() => {});
        await SecureStore.deleteItemAsync('user_id').catch(() => {});
        await SecureStore.deleteItemAsync('user_role').catch(() => {});
        console.log('AccountManager: SecureStore cleared');
      }
    } catch (error) {
      console.error('AccountManager: SecureStore sync failed:', error);
    }
  }

  private async migrateIfNeeded(): Promise<void> {
    if (this.accountGroup.version < CURRENT_VERSION) {
      console.log(`AccountManager: Migrating from v${this.accountGroup.version} to v${CURRENT_VERSION}`);
      
      if (this.accountGroup.version === 1) {
        this.accountGroup.accounts = this.accountGroup.accounts.map(account => ({
          ...account,
          role: this.validateRole(account.role),
          lastUsed: this.parseTimestamp(account.lastUsed),
          createdAt: this.parseTimestamp(account.createdAt)
        }));
      }
      
      this.accountGroup.version = CURRENT_VERSION;
      await this.persistImmediate();
      console.log('AccountManager: Migration completed');
    }
  }

  getCurrentAccount(): AccountData | null {
    if (!this.accountGroup.currentAccountId) return null;
    
    const account = this.accountGroup.accounts.find(
      acc => acc.id === this.accountGroup.currentAccountId
    );
    
    if (account && this.validateAccount(account)) {
      return account;
    }
    
    if (account) {
      console.warn('AccountManager: Current account invalid, clearing');
      this.accountGroup.currentAccountId = null;
      this.persistImmediate().catch(() => {});
    }
    
    return null;
  }

  getAllAccounts(): AccountData[] {
    return this.accountGroup.accounts.filter(account => this.validateAccount(account));
  }

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

    if (this.accountGroup.currentAccountId === accountId) {
      if (this.accountGroup.accounts.length > 0) {
        const mostRecent = this.accountGroup.accounts.reduce((prev, current) => 
          (prev.lastUsed > current.lastUsed) ? prev : current
        );
        await this.setCurrentAccount(mostRecent.id);
      } else {
        await this.clearAllAccounts();
        return;
      }
    }

    await this.persistImmediate();
    console.log('AccountManager: Account removed:', removedAccount.email);
  }

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

    await this.persistImmediate();
    console.log('AccountManager: Account updated:', account.email);
  }

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

  private async clearAllStorage(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('auth_token').catch(() => {}),
        SecureStore.deleteItemAsync('user_id').catch(() => {}),
        SecureStore.deleteItemAsync('user_role').catch(() => {})
      ]);
      
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY),
        AsyncStorage.removeItem(CURRENT_ACCOUNT_KEY),
        AsyncStorage.removeItem(BACKUP_KEY)
      ]);
      
    } catch (error) {
      console.error('AccountManager: Failed to clear storage:', error);
    }
  }

  getCurrentToken(): string | null {
    const current = this.getCurrentAccount();
    return current?.token && current.token.length > 0 ? current.token : null;
  }

  getCurrentUserId(): string | null {
    const current = this.getCurrentAccount();
    return current?.id && current.id.length > 0 ? current.id : null;
  }

  getCurrentRole(): string | null {
    const current = this.getCurrentAccount();
    return current?.role || null;
  }

  getCurrentUserData(): any | null {
    const current = this.getCurrentAccount();
    return current?.userData || null;
  }

  hasAccounts(): boolean {
    return this.accountGroup.accounts.length > 0;
  }

  hasAccount(accountId: string): boolean {
    return this.accountGroup.accounts.some(acc => acc.id === accountId);
  }

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

  async forceReinitialize(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }
}

export const accountManager = AccountManager.getInstance();