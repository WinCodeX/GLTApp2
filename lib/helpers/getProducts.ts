import api from '../api';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const buildPageKey = (page: number, query: string) => {
  const trimmed = query.trim().toLowerCase().replace(/\s+/g, '_');
  return `products_cache_page_${page}_${trimmed || 'default'}`;
};

const buildAllKey = (query: string) => {
  const trimmed = query.trim().toLowerCase().replace(/\s+/g, '_');
  return `products_cache_all_${trimmed || 'default'}`;
};

const buildMetaKey = (query: string) => {
  const trimmed = query.trim().toLowerCase().replace(/\s+/g, '_');
  return `products_meta_${trimmed || 'default'}`;
};

export const getProducts = async (
  page: number = 1,
  forceRefresh: boolean = false,
  perPage: number = 10
) => {
  const token = await SecureStore.getItemAsync('auth_token');
  const netState = await NetInfo.fetch();

  const pageKey = buildPageKey(page, '');
  const allKey = buildAllKey('');
  const metaKey = buildMetaKey('');
  const params = { page, per_page: perPage };

  const fetchAndCache = async () => {
    const res = await api.get('/api/v1/products', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });

    const response = res.data || {};
    const productBlock = response.products || {};
    const products = productBlock.data || [];
    const meta = productBlock.meta || {};

    console.log(`✅ Meta from API (page ${page}):`, meta);

    const validated = products.map((product: any) => ({
      ...product,
      attributes: {
        ...product.attributes,
        image_url: product.attributes.image_url?.startsWith('/')
          ? `${api.defaults.baseURL}${product.attributes.image_url}`
          : product.attributes.image_url,
      },
    }));

    // Save individual page with timestamp
    const pageData = {
      products: validated,
      meta,
      timestamp: Date.now(),
      page
    };
    await AsyncStorage.setItem(pageKey, JSON.stringify(pageData));

    // Update global meta information
    const globalMeta = {
      ...meta,
      last_updated: Date.now(),
      cached_pages: await getCachedPageNumbers()
    };
    await AsyncStorage.setItem(metaKey, JSON.stringify(globalMeta));

    // Merge into offline global cache
    const existingAll = await AsyncStorage.getItem(allKey);
    const existingList = existingAll ? JSON.parse(existingAll).products : [];

    const validatedIds = new Set(validated.map(p => p.id));
    const allMerged = [
      ...existingList.filter(p => !validatedIds.has(p.id)),
      ...validated,
    ];

    await AsyncStorage.setItem(allKey, JSON.stringify({ 
      products: allMerged,
      timestamp: Date.now()
    }));

    return { products: validated, meta };
  };

  // Helper function to get cached page numbers
  const getCachedPageNumbers = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys
        .filter(key => key.startsWith('products_cache_page_') && key.endsWith('_default'))
        .map(key => {
          const match = key.match(/page_(\d+)_/);
          return match ? parseInt(match[1]) : null;
        })
        .filter(Boolean)
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  };

  // Helper function to simulate pagination from cache
  const getPaginatedCacheData = async (requestedPage: number) => {
    const cachedAll = await AsyncStorage.getItem(allKey);
    const cachedMeta = await AsyncStorage.getItem(metaKey);
    
    if (!cachedAll) return null;

    const { products: allProducts } = JSON.parse(cachedAll);
    const startIndex = (requestedPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    const pageProducts = allProducts.slice(startIndex, endIndex);

    // If we have no products for this page, return null
    if (pageProducts.length === 0 && requestedPage > 1) {
      return null;
    }

    // Calculate pagination info
    const totalPages = Math.ceil(allProducts.length / perPage);
    const hasMore = requestedPage < totalPages;

    const meta = cachedMeta ? JSON.parse(cachedMeta) : {
      current_page: requestedPage,
      total_pages: totalPages,
      has_more: hasMore,
      total_count: allProducts.length,
    };

    // Update meta with current pagination info
    meta.current_page = requestedPage;
    meta.has_more = hasMore;
    meta.total_pages = totalPages;

    console.log(`📦 Simulated page ${requestedPage} from cache (${pageProducts.length} products, hasMore: ${hasMore})`);
    
    return { products: pageProducts, meta };
  };

  // Force refresh logic
  if (netState.isConnected && forceRefresh) {
    try {
      console.log('🔥 Force-refreshing from live API...');
      return await fetchAndCache();
    } catch (err) {
      console.warn('🔥 Force-refresh failed, trying cache fallback...', err.message);
    }
  }

  // Online fetch logic
  if (netState.isConnected) {
    try {
      console.log(`🌐 Fetching page ${page} from live API...`);
      return await fetchAndCache();
    } catch (err) {
      console.warn(`❌ Live fetch failed for page ${page}, trying cache fallback...`, err.message);
    }
  }

  // Fallback 1: Try individual page cache (most recent and accurate)
  const cachedPage = await AsyncStorage.getItem(pageKey);
  if (cachedPage) {
    const { products, meta, timestamp } = JSON.parse(cachedPage);
    
    // Check if cache is not too old (optional: you can remove this if you want)
    const cacheAge = Date.now() - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (cacheAge < maxAge) {
      console.log(`📦 Loaded page ${page} from individual cache (${cacheAge / 1000 / 60} minutes old)`);
      return { products, meta };
    } else {
      console.log(`⏰ Individual cache for page ${page} is too old, trying alternative...`);
    }
  }

  // Fallback 2: Try to simulate pagination from global cache
  const paginatedCache = await getPaginatedCacheData(page);
  if (paginatedCache) {
    return paginatedCache;
  }

  // Fallback 3: Return empty results with proper pagination info
  console.log(`📭 No cache available for page ${page}, returning empty results`);
  return {
    products: [],
    meta: {
      current_page: page,
      total_pages: page,
      has_more: false,
      total_count: 0,
    },
  };
};

// Helper function to clear old cache (call this periodically or on app start)
export const clearOldCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const productKeys = keys.filter(key => key.startsWith('products_cache_'));
    
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const key of productKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const { timestamp } = JSON.parse(data);
          if (timestamp && (now - timestamp) > maxAge) {
            await AsyncStorage.removeItem(key);
            console.log(`🗑️ Cleared old cache: ${key}`);
          }
        }
      } catch (err) {
        // If we can't parse the cache item, remove it
        await AsyncStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('Failed to clear old cache:', err);
  }
};