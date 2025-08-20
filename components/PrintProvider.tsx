// components/PrintProvider.tsx - JSX component for print context
import React, { ReactNode } from 'react';
import { PrintContext, usePrintContextValue } from '../hooks/usePrintService';

interface PrintProviderProps {
  children: ReactNode;
}

export const PrintProvider: React.FC<PrintProviderProps> = ({ children }) => {
  const value = usePrintContextValue();

  return (
    <PrintContext.Provider value={value}>
      {children}
    </PrintContext.Provider>
  );
};