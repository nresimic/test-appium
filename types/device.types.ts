// Re-export WebDriverIO capabilities instead of redefining them
export type DeviceCapabilities = import('@wdio/types').Capabilities.RequestedStandaloneCapabilities;

export interface DeviceFarmDevice {
  id: string;
  name: string;
  model: string;
  os: string;
  osVersion: string;
  manufacturer: string;
  formFactor: string;
  availability: string;
}

export interface LocalDevice {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  version: string;
}