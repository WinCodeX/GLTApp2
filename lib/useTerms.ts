// lib/useTerms.ts
import { useState, useEffect } from 'react';
import termsService from './termsService';

interface TermsData {
  id: number;
  title: string;
  content: string;
  version: string;
  term_type: string;
  effective_date: string;
  summary?: string;
}

interface UseTermsResult {
  data: TermsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing terms and conditions
 */
export const useTerms = (type: 'terms_of_service' | 'privacy_policy' = 'terms_of_service'): UseTermsResult => {
  const [data, setData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await termsService.getTerms(type);
      
      if (result) {
        setData(result);
      } else {
        setError(`Failed to load ${type.replace('_', ' ')}`);
      }
    } catch (err: any) {
      setError(err.message || `Failed to load ${type.replace('_', ' ')}`);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await termsService.refreshTerms(type);
      
      if (result) {
        setData(result);
      } else {
        setError(`Failed to refresh ${type.replace('_', ' ')}`);
      }
    } catch (err: any) {
      setError(err.message || `Failed to refresh ${type.replace('_', ' ')}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, [type]);

  return {
    data,
    loading,
    error,
    refresh,
  };
};

/**
 * Hook for checking if terms are available and cached
 */
export const useTermsStatus = () => {
  const [status, setStatus] = useState<{
    terms: { cached: boolean; valid: boolean; version?: string };
    privacy: { cached: boolean; valid: boolean; version?: string };
  } | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const cacheStatus = await termsService.getCacheStatus();
      setStatus(cacheStatus);
    };

    checkStatus();
  }, []);

  return status;
};

// Example App.tsx integration:
/*
// App.tsx or your root component
import React, { useEffect, useState } from 'react';
import termsService from './lib/termsService';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize terms on app startup
        await termsService.initializeTerms();
        
        // Other initialization code...
        
        setIsReady(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        setIsReady(true); // Still show app even if terms failed
      }
    };

    initializeApp();
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return <YourMainApp />;
}
*/