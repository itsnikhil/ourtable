/* Our Table — Web Push service worker (M8 / HLD §6.3). */

self.addEventListener("push", (event) => {
  let title = "Our Table";
  let body = "Something new from your partner.";
  let url = "/";

  try {
    if (event.data) {
      const payload = event.data.json();
      if (typeof payload.title === "string" && payload.title) {
        title = payload.title;
      }
      if (typeof payload.body === "string" && payload.body) {
        body = payload.body;
      }
      if (typeof payload.url === "string" && payload.url) {
        url = payload.url;
      }
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) body = text;
    } catch {
      /* keep defaults */
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
