self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "Nova solicitação",
    body: "Você recebeu uma solicitação de contato.",
    url: "/dashboard/profissional",
  };

  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload = {
      ...payload,
      body: event.data.text() || payload.body,
    };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/images/logo/encontro-pirituba-logo.png",
      badge: "/images/logo/encontro-pirituba-logo.png",
      data: { url: payload.url || "/dashboard/profissional" },
      tag: "contact-release-request",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/dashboard/profissional";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
