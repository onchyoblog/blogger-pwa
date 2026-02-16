import { cacheNames, clientsClaim, setCacheNameDetails } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

setCacheNameDetails({
  prefix: 'blogger-pwa',
  suffix: 'v1',
  precache: 'install-time',
  runtime: 'run-time',
});

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

setDefaultHandler(new NetworkOnly());

const version = cacheNames.suffix;

registerRoute(
  /.(?:css|js|png|gif|jpg|svg|ico)$/,
  new CacheFirst({
    cacheName: `images-js-css-${version}`,
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 24 * 60 * 60,
        maxEntries: 200,
        purgeOnQuotaError: true,
      }),
    ],
  }),
  'GET',
);

setCatchHandler(async ({ request }) => {
  switch (request.destination) {
    case 'document': {
      return matchPrecache('/app/offline') as Promise<Response>;
    }
    default: {
      return Response.error();
    }
  }
});

// --- PHẦN THÊM MỚI ĐỂ LÀM APP ---

// 1. Lắng nghe sự kiện Push (Từ Firebase hoặc hệ thống gửi về)
self.addEventListener('push', (event: any) => {
  let data = { title: 'TBM Notification', body: 'Bạn có cập nhật mới', ticketId: '' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEikLlisrLoyVmotwn3W0B9E01jzyIaCyMFtWhsdOmLDnK9okLgCCn-n0ZHqztQhgrMCq6Jo8UWv4oQu3lbFvDyxXHlrXz33GSM02wdNpZ3dZmX4TZezJCIyCBPR3TDhVud8bS3DWG7JCGUekN7gdlXjXc7tpkFrv97_gi4tLsGplthqFuS1hg-ytIn0JyA/s0/TBM-512x512%20-%20PNG.png', // Thay bằng logo của bạn
    badge: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEikLlisrLoyVmotwn3W0B9E01jzyIaCyMFtWhsdOmLDnK9okLgCCn-n0ZHqztQhgrMCq6Jo8UWv4oQu3lbFvDyxXHlrXz33GSM02wdNpZ3dZmX4TZezJCIyCBPR3TDhVud8bS3DWG7JCGUekN7gdlXjXc7tpkFrv97_gi4tLsGplthqFuS1hg-ytIn0JyA/s0/TBM-512x512%20-%20PNG.png',
    vibrate: [200, 100, 200, 100, 400], // Rung điện thoại
    tag: data.ticketId || 'general',
    renotify: true,
    data: {
      url: self.location.origin + '/#ticketId=' + data.ticketId
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 2. Xử lý khi người dùng chạm vào thông báo trên màn hình khóa
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close(); // Đóng thông báo ngay

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu App đang mở, chuyển hướng nó đến Ticket đó
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          (client as any).postMessage({
            type: 'NAVIGATE_TICKET',
            ticketId: event.notification.data.url.split('=')[1]
          });
          return client.focus();
        }
      }
      // Nếu App đang đóng, mở mới hoàn toàn
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});
