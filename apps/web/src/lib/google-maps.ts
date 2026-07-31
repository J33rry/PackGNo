const GOOGLE_MAPS_SRC = 'https://maps.googleapis.com/maps/api/js';

export interface GoogleMapsRuntime {
  maps: any;
}

let loader: Promise<GoogleMapsRuntime> | null = null;
const importedLibraries = new Map<string, Promise<any>>();

function mapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
}

export function hasGoogleMapsKey(): boolean {
  return mapsApiKey().length > 0;
}

/**
 * Install the official Google Maps Dynamic Library Import bootstrap.
 *
 * This is the inline bootstrapper from:
 * https://developers.google.com/maps/documentation/javascript/load-maps-js-api#dynamic-library-import
 *
 * It registers `google.maps.importLibrary` as a thin queuing shim, appends
 * the API `<script>`, and the real Maps JS API seamlessly replaces the shim
 * once loaded.  Using the official snippet avoids timing bugs that arise from
 * hand-rolled bootstrap approaches.
 */
function installBootstrap(): void {
  // If the real API (or a prior bootstrap) already registered importLibrary, skip.
  if (typeof (window as any).google?.maps?.importLibrary === 'function') return;

  /* ---------- Official bootstrap (minified, adapted to TS) ---------- */
  const g: any = ((window as any).google = (window as any).google || {});
  const m: any = (g.maps = g.maps || {});
  const libraries: any[] = (m.__ib__ = m.__ib__ || []);

  // The shim: queue up importLibrary() calls until the real API flushes them.
  m.importLibrary = (name: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      libraries.push([name, resolve, reject]);
    });
  };

  // Append the actual script tag.
  const key = encodeURIComponent(mapsApiKey());
  const script = document.createElement('script');
  script.src = `${GOOGLE_MAPS_SRC}?key=${key}&v=weekly&loading=async&callback=__gm_ib__`;
  script.async = true;
  script.defer = true;
  script.dataset.googleMapsLoader = 'true';
  script.onerror = () => {
    // Reject all queued importLibrary calls.
    for (const entry of libraries) {
      if (typeof entry[2] === 'function') entry[2](new Error('Failed to load Google Maps.'));
    }
  };

  // Register the callback that the API will invoke once it's ready.
  (window as any).__gm_ib__ = () => {
    // At this point google.maps.importLibrary is the *real* function.
    // Flush all queued requests.
    for (const entry of libraries) {
      const [name, resolve, reject] = entry;
      (window as any).google.maps.importLibrary(name).then(resolve, reject);
    }
    libraries.length = 0;
    delete (window as any).__gm_ib__;
  };

  document.head.appendChild(script);
}

export function loadGoogleMaps(): Promise<GoogleMapsRuntime> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'));
  }
  if (!hasGoogleMapsKey()) {
    return Promise.reject(
      new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to apps/web/.env.local.'),
    );
  }
  // If the real API is already fully loaded, reuse it.
  if ((window as any).google?.maps?.Map) {
    return Promise.resolve((window as any).google);
  }
  if (loader) return loader;

  // Install the bootstrap if it hasn't been installed yet.
  installBootstrap();

  // Wait for the `maps` core library to signal that the API is usable.
  loader = (window as any).google.maps
    .importLibrary('maps')
    .then(() => (window as any).google as GoogleMapsRuntime);

  return loader;
}

export async function importGoogleMapsLibrary<T = any>(name: string): Promise<T> {
  await loadGoogleMaps();
  const maps = (window as any).google?.maps;
  if (typeof maps?.importLibrary !== 'function') {
    throw new Error('Google Maps loaded without importLibrary support.');
  }

  const existing = importedLibraries.get(name);
  if (existing) return existing as Promise<T>;

  const pending = maps.importLibrary(name);
  importedLibraries.set(name, pending);
  return pending as Promise<T>;
}

declare global {
  interface Window {
    google?: GoogleMapsRuntime;
  }
}

