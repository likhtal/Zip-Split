const CACHE_NAME = 'zip-split-cache-v1';
const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const HTML_CONTENT_TYPE = 'text/html';
const FONT_ORIGINS = ['https://fonts.gstatic.com', 'https://fonts.googleapis.com', 
                      'https://stackpath.bootstrapcdn.com', 'https://code.jquery.com/', 'https://cdnjs.cloudflare.com/ajax/libs/',
                      'https://stackpath.bootstrapcdn.com/bootstrap/'];

const PRE_CACHED_ASSETS = [
  '/index.html',
   "/static/css/msa_typed.css",
   "/static/img/favicon.ico",
   "/static/img/download-32.png", 
   "/static/img/1x1.png", 
   "/static/img/logos/logo-allstate-innovate2.png", 
   "/static/js/js.utils.js", 
   "/static/js/FileSaver/FileSaver.min.js",
   "/static/js/FileSaver/FileSaver.min.js.map",
];

function isNavigationRequest(event) {
  return event.request.mode === 'navigate';
}

function isCachedAssetRequest(event) {
  let isSameOriginRequest = event.request.url.startsWith(self.location.origin);
  let isFontRequest = FONT_ORIGINS.some((origin) => event.request.url.startsWith(origin));

  return !isNavigationRequest(event) && (isSameOriginRequest || isFontRequest);
}

function isHtmlRequest(event) {
  let isGetRequest = event.request.method === 'GET';
  let isHTMLRequest = event.request.headers.get('accept').startsWith(HTML_CONTENT_TYPE);

  return isNavigationRequest(event) || (isGetRequest && isHTMLRequest);
}

self.addEventListener('install', function(event) {
  let now = Date.now();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      let cachePromises = PRE_CACHED_ASSETS.map(function(asset) {
        var url = new URL(asset, location.href);
        var request = new Request(url, { mode: 'no-cors' });
        return fetch(request).then(function(response) {
          if (response.status >= 400) {
            throw new Error('prefetch failed!');
          }
          return cache.put(asset, response);
        });
      });

      return Promise.all(cachePromises);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        // delete old caches
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  if (isCachedAssetRequest(event)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          if (response) {
            return response;
          } else {
            return fetch(event.request.clone()).then(function(response) {
              let contentType = response.headers.get('content-type') || '';
              if (response.status < 400 && !contentType.startsWith(JSON_API_CONTENT_TYPE)) {
                cache.put(event.request, response.clone());
              }
              return response;
            });
          }
        });
      })
    );
  }
});

self.addEventListener('fetch', function(event) {
  if (isHtmlRequest(event)) {
    event.respondWith(
      fetch(event.request).catch(error => {
        return caches.match('index.html');
      })
    );
  }
});
