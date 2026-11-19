import { supabase } from '../supabaseClient';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
let interceptorInstalled = false;

function extractUrlString(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

function isApiUrl(url) {
  if (!url) return false;
  if (url.startsWith('/api/') || url === '/api') return true;
  if (API_BASE && (url.startsWith(`${API_BASE}/api/`) || url === `${API_BASE}/api`)) {
    return true;
  }
  if (typeof window !== 'undefined' && url.startsWith(`${window.location.origin}/api/`)) {
    return true;
  }
  return false;
}

function hasAuthorizationHeader(headers) {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has('Authorization');
  if (Array.isArray(headers)) {
    return headers.some(([k]) => String(k).toLowerCase() === 'authorization');
  }
  if (typeof headers === 'object') {
    return Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
  }
  return false;
}

function mergeHeaders(baseHeaders, initHeaders, token) {
  const merged = new Headers(baseHeaders || undefined);
  if (initHeaders) {
    new Headers(initHeaders).forEach((value, key) => {
      merged.set(key, value);
    });
  }
  if (token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
}

export async function getAuthHeaders(extraHeaders = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ...extraHeaders };
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export async function authFetch(url, options = {}) {
  const headers = await getAuthHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}

export function installApiAuthInterceptor() {
  if (typeof window === 'undefined' || interceptorInstalled) return;
  interceptorInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = extractUrlString(input);
    if (!isApiUrl(url)) {
      return nativeFetch(input, init);
    }

    const requestHeaders = input instanceof Request ? input.headers : undefined;
    if (hasAuthorizationHeader(init?.headers) || hasAuthorizationHeader(requestHeaders)) {
      return nativeFetch(input, init);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        return nativeFetch(input, init);
      }

      const headers = mergeHeaders(requestHeaders, init?.headers, token);
      return nativeFetch(input, { ...init, headers });
    } catch {
      return nativeFetch(input, init);
    }
  };
}
