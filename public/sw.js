self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "GESTEC", body: event.data.text() };
    }
  }

  const title = data.title || "GESTEC";
  const options = {
    body: data.body || "Você recebeu uma nova notificação.",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: {
      url: data.url || "/",
      ...(data.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.includes(url));
      if (matchingClient) return matchingClient.focus();
      return self.clients.openWindow(url);
    }),
  );
});
