import { createContext, useContext } from 'react';
import useData from '../hooks/useData.js';
import { getPending } from '../services/operations.js';

const OperationsContext = createContext({ pendingCount: 0 });
export function OperationsProvider({ children }) {
  const pending = useData(getPending, [], { interval: 15000 });
  return <OperationsContext.Provider value={{ pendingCount: pending.data?.length || 0, refreshPending: pending.reload }}>{children}</OperationsContext.Provider>;
}
export const useOperations = () => useContext(OperationsContext);
