export type DataMode = 'unconfigured' | 'cloud' | 'go';
export type DashboardStatus = 'unconfigured' | 'first-sync' | 'error' | 'ready';

export function dashboardCapabilities(mode: DataMode, privateStorage = false) {
  return {
    sync: mode === 'cloud',
    budget: mode === 'go',
    goals: mode === 'go',
    investments: mode === 'cloud' || (mode === 'go' && privateStorage),
    analysis: mode === 'cloud' || (mode === 'go' && privateStorage)
  };
}

export function dashboardState(
  mode: DataMode,
  status: DashboardStatus,
  authenticated = false,
  privateStorage = false
) {
  return {
    mode,
    status,
    authenticated,
    capabilities: dashboardCapabilities(mode, privateStorage)
  };
}
