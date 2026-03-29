/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "*.vue" {
  import { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "virtual:pwa-register" {
  interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
