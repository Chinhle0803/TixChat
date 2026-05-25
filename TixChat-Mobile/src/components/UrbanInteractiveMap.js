import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { formatLocationLabel } from '../utils/addressFormat'

const NativeWebView = Platform.OS === 'web' ? null : require('react-native-webview').WebView

const DEFAULT_CENTER = { lat: 10.776889, lng: 106.700806 }
const CATEGORY_SYMBOLS = {
  electricity: '⚡',
  water: '💧',
  traffic: '🚗',
  tree: '🌳',
  flood: '🌊',
  waste: '🗑',
  street_light: '💡',
  construction: '🚧',
  other: '📍',
}

const MAP_HTML = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #dbeafe;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-control-zoom {
        border: none !important;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18) !important;
        overflow: hidden;
        border-radius: 22px !important;
      }

      .leaflet-control-zoom a {
        width: 68px !important;
        height: 68px !important;
        line-height: 68px !important;
        font-size: 34px !important;
        color: #0f172a !important;
      }

      .leaflet-control-current-location {
        border: none !important;
        border-radius: 22px !important;
        overflow: hidden;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18) !important;
      }

      .leaflet-control-current-location button {
        width: 68px;
        height: 68px;
        border: 0;
        background: #ffffff;
        color: #2563eb;
        font-size: 34px;
        font-weight: 900;
        line-height: 68px;
        text-align: center;
        cursor: pointer;
      }

      .leaflet-control-current-location button.is-loading {
        opacity: 0.65;
      }

      .current-location-marker {
        background: transparent;
        border: none;
      }

      .current-location-dot {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #2563eb;
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.18), 0 8px 18px rgba(15, 23, 42, 0.22);
      }

      .leaflet-bottom.leaflet-right {
        bottom: 112px;
        right: 16px;
      }

      .incident-marker {
        background: transparent;
        border: none;
      }

      .pin {
        width: 34px;
        height: 34px;
        border-radius: 17px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255, 255, 255, 0.95);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
        font-size: 16px;
        transform: translateZ(0);
      }

      .pin-active {
        transform: scale(1.12);
        box-shadow: 0 10px 26px rgba(37, 99, 235, 0.34);
      }

      .pin-pending { background: #f59e0b; }
      .pin-progress { background: #0ea5e9; }
      .pin-resolved { background: #22c55e; }

      .map-attribution {
        position: absolute;
        left: 12px;
        bottom: 12px;
        z-index: 500;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.92);
        color: #475569;
        font-size: 11px;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
      }
    </style>
    <script>
      window.__pendingPayload = { posts: [], selectedPostId: null };
      window.__markerMap = {};
      window.__currentLocationMarker = null;
      window.__currentLocationCircle = null;
      window.__viewportInitialized = false;
      window.__userMovedMap = false;

      window.__sendMessage = function(type, payload) {
        var message = JSON.stringify({ type: type, payload: payload });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(message);
        }
        if (window.parent && window.parent !== window && window.parent.postMessage) {
          window.parent.postMessage(message, '*');
        }
      };

      window.__getTone = function(status) {
        if (status === 'resolved') return 'resolved';
        if (status === 'in_progress') return 'progress';
        return 'pending';
      };

      window.__buildIcon = function(post, isActive) {
        var symbolMap = ${JSON.stringify(CATEGORY_SYMBOLS)};
        var symbol = symbolMap[post.category] || symbolMap.other;
        var tone = window.__getTone(post.status);
        var className = 'pin pin-' + tone + (isActive ? ' pin-active' : '');
        return window.L.divIcon({
          className: 'incident-marker',
          html: '<div class="' + className + '"><span>' + symbol + '</span></div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
      };

      window.__renderMarkers = function(posts, selectedPostId) {
        if (!window.mapInstance || !window.L) return;

        Object.keys(window.__markerMap).forEach(function(key) {
          window.mapInstance.removeLayer(window.__markerMap[key]);
        });
        window.__markerMap = {};

        posts.forEach(function(post) {
          if (!post || !Number.isFinite(post.lat) || !Number.isFinite(post.lng)) return;
          var marker = window.L.marker([post.lat, post.lng], {
            icon: window.__buildIcon(post, post.postId === selectedPostId),
          });
          marker.on('click', function() {
            window.__sendMessage('marker_press', { postId: post.postId });
          });
          if (post.address || post.categoryLabel) {
            var tooltip = [post.categoryLabel, post.address].filter(Boolean).join(' • ');
            marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -16] });
          }
          marker.addTo(window.mapInstance);
          window.__markerMap[post.postId] = marker;
        });
      };

      window.__applyPayload = function() {
        if (!window.mapInstance || !window.L) return;

        var payload = window.__pendingPayload || { posts: [], selectedPostId: null };
        var posts = Array.isArray(payload.posts) ? payload.posts : [];
        var selectedPostId = payload.selectedPostId || null;

        window.__renderMarkers(posts, selectedPostId);

        if (selectedPostId && window.__markerMap[selectedPostId]) {
          var selectedMarker = window.__markerMap[selectedPostId];
          window.mapInstance.flyTo(selectedMarker.getLatLng(), Math.max(window.mapInstance.getZoom(), 15), {
            animate: true,
            duration: 0.45,
          });
          return;
        }

        if (!window.__viewportInitialized && posts.length > 0) {
          var points = posts
            .filter(function(post) { return Number.isFinite(post.lat) && Number.isFinite(post.lng); })
            .map(function(post) { return [post.lat, post.lng]; });

          if (points.length === 1) {
            window.mapInstance.setView(points[0], 15);
          } else if (points.length > 1) {
            window.mapInstance.fitBounds(points, { padding: [28, 28] });
          }
          window.__viewportInitialized = true;
          return;
        }

        if (!window.__viewportInitialized && posts.length === 0) {
          window.mapInstance.setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 13);
          window.__viewportInitialized = true;
        }
      };

      window.__updateMap = function(payload) {
        window.__pendingPayload = payload || { posts: [], selectedPostId: null };
        window.__applyPayload();
      };

      window.__setLocateButtonBusy = function(button, busy) {
        if (!button) return;
        button.disabled = busy;
        button.classList.toggle('is-loading', busy);
        button.textContent = busy ? '…' : '⌖';
      };

      window.__showCurrentLocation = function(lat, lng, accuracy) {
        if (!window.mapInstance || !window.L) return;

        var point = [lat, lng];
        var markerIcon = window.L.divIcon({
          className: 'current-location-marker',
          html: '<div class="current-location-dot"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        if (window.__currentLocationMarker) {
          window.__currentLocationMarker.setLatLng(point);
        } else {
          window.__currentLocationMarker = window.L.marker(point, {
            icon: markerIcon,
            zIndexOffset: 1000,
          }).addTo(window.mapInstance);
        }

        if (window.__currentLocationCircle) {
          window.mapInstance.removeLayer(window.__currentLocationCircle);
        }

        window.__currentLocationCircle = window.L.circle(point, {
          radius: Math.min(Math.max(Number(accuracy) || 40, 24), 500),
          color: '#2563eb',
          weight: 1,
          fillColor: '#93c5fd',
          fillOpacity: 0.18,
        }).addTo(window.mapInstance);

        window.__userMovedMap = true;
        window.mapInstance.flyTo(point, Math.max(window.mapInstance.getZoom(), 16), {
          animate: true,
          duration: 0.45,
        });
      };

      window.__locateCurrentPosition = function(button) {
        if (!navigator.geolocation) {
          alert('Thiết bị chưa hỗ trợ lấy vị trí hiện tại.');
          return;
        }

        window.__setLocateButtonBusy(button, true);
        navigator.geolocation.getCurrentPosition(
          function(position) {
            window.__setLocateButtonBusy(button, false);
            window.__showCurrentLocation(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy
            );
          },
          function() {
            window.__setLocateButtonBusy(button, false);
            alert('Không thể lấy vị trí hiện tại. Hãy cấp quyền vị trí rồi thử lại.');
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 15000,
          }
        );
      };

      window.__locateCurrentPosition = function(button) {
        window.__locateButton = button;
        window.__setLocateButtonBusy(button, true);
        window.__sendMessage('locate_request', {});
      };

      window.__finishLocateRequest = function(success, payload) {
        window.__setLocateButtonBusy(window.__locateButton, false);
        if (success && payload) {
          window.__showCurrentLocation(payload.lat, payload.lng, payload.accuracy);
        }
      };

      window.addEventListener('message', function(event) {
        try {
          var data = JSON.parse(event.data || '{}');
          if (data && data.type === 'update_map') {
            window.__updateMap(data.payload || { posts: [], selectedPostId: null });
          } else if (data && data.type === 'finish_locate_request') {
            window.__finishLocateRequest(Boolean(data.success), data.payload || null);
          }
        } catch (_) {}
      });
    </script>
  </head>
  <body>
    <div id="map"></div>
    <div class="map-attribution">Kéo, thu phóng và chạm vào ghim để xem sự cố</div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      (function boot() {
        if (!window.L) {
          setTimeout(boot, 50);
          return;
        }

        window.mapInstance = window.L.map('map', {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
          worldCopyJump: true,
        }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 13);

        window.L.control.zoom({ position: 'bottomright' }).addTo(window.mapInstance);

        var CurrentLocationControl = window.L.Control.extend({
          options: { position: 'bottomright' },
          onAdd: function() {
            var container = window.L.DomUtil.create('div', 'leaflet-bar leaflet-control-current-location');
            var button = window.L.DomUtil.create('button', '', container);
            button.type = 'button';
            button.title = 'Tọa độ hiện tại';
            button.setAttribute('aria-label', 'Tọa độ hiện tại');
            button.textContent = '⌖';
            window.L.DomEvent.disableClickPropagation(container);
            window.L.DomEvent.on(button, 'click', function(event) {
              window.L.DomEvent.stop(event);
              window.__locateCurrentPosition(button);
            });
            return container;
          },
        });
        new CurrentLocationControl().addTo(window.mapInstance);

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        }).addTo(window.mapInstance);

        window.mapInstance.on('dragstart zoomstart', function() {
          window.__userMovedMap = true;
        });

        window.__applyPayload();
        window.__sendMessage('map_ready', {});
      })();
    </script>
  </body>
</html>`

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#dbeafe',
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#dbeafe',
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
})

export default function UrbanInteractiveMap({
  posts = [],
  selectedPostId = null,
  onSelectPost,
  onLocateRequest,
  style,
}) {
  const webViewRef = useRef(null)
  const iframeRef = useRef(null)
  const [loaded, setLoaded] = useState(false)

  const payload = useMemo(() => ({
    posts: posts
      .map((post) => ({
        postId: post.postId,
        lat: Number(post?.location?.lat),
        lng: Number(post?.location?.lng),
        status: post?.status || 'pending',
        category: post?.category || 'other',
        categoryLabel: String(post?.categoryLabel || ''),
        address: String(formatLocationLabel(post?.location) || ''),
      }))
      .filter((post) => Number.isFinite(post.lat) && Number.isFinite(post.lng)),
    selectedPostId,
  }), [posts, selectedPostId])

  const syncMap = useCallback(() => {
    if (!loaded) return

    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: 'update_map', payload }),
        '*'
      )
      return
    }

    if (!webViewRef.current) return
    const serialized = JSON.stringify(payload).replace(/</g, '\\u003c')
    webViewRef.current.injectJavaScript(`window.__updateMap(${serialized}); true;`)
  }, [loaded, payload])

  useEffect(() => {
    syncMap()
  }, [syncMap])

  const finishLocateRequest = useCallback((success, location = null) => {
    const payload = location ? JSON.stringify(location).replace(/</g, '\\u003c') : 'null'
    const script = `window.__finishLocateRequest(${success ? 'true' : 'false'}, ${payload}); true;`

    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: 'finish_locate_request', success, payload: location }),
        '*'
      )
      return
    }

    webViewRef.current?.injectJavaScript(script)
  }, [])

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event?.nativeEvent?.data || '{}')
      if (data?.type === 'map_ready') {
        setLoaded(true)
        return
      }
      if (data?.type === 'marker_press' && data?.payload?.postId) {
        onSelectPost?.(data.payload.postId)
        return
      }
      if (data?.type === 'locate_request') {
        Promise.resolve(onLocateRequest?.())
          .then((location) => finishLocateRequest(Boolean(location), location || null))
          .catch(() => finishLocateRequest(false))
      }
    } catch (_) {
      // Ignore malformed bridge payloads from the webview runtime.
    }
  }, [finishLocateRequest, onLocateRequest, onSelectPost])

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined

    const handleWindowMessage = (event) => {
      if (typeof event?.data !== 'string') return
      handleMessage({ nativeEvent: { data: event.data } })
    }

    window.addEventListener('message', handleWindowMessage)
    return () => window.removeEventListener('message', handleWindowMessage)
  }, [handleMessage])

  return (
    <View style={[styles.container, style]}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          title="Bản đồ sự cố đô thị"
          srcDoc={MAP_HTML}
          style={styles.iframe}
          allow="geolocation"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <NativeWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: MAP_HTML }}
          style={styles.webview}
          onMessage={handleMessage}
          onLoadEnd={() => setLoaded(true)}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          scrollEnabled={false}
          overScrollMode="never"
        />
      )}
      {!payload.posts.length ? (
        <View pointerEvents="none" style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>Chưa có điểm sự cố có tọa độ.</Text>
        </View>
      ) : null}
    </View>
  )
}
