export interface OceansanElectronApi {
  openDirectory: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    oceansan?: OceansanElectronApi;
  }
}

export {};
