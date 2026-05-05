# trackit-stalk-app

TrackIT web client embedded as a sTalk app (Apps tab → iframe widget).

## Origin

Forked from `trackit-mobile` (React Native / Expo). iOS/Android targets removed —
this fork builds **only for web** via Expo web (Metro static export).

## Architecture

```
sTalk web (Element X fork)
  └─ Apps tab → AppDetailView (iframe)
       └─ https://stalk.implica.ru/widgets/trackit-stalk-app/
            └─ Expo web SPA (this repo)
                 └─ Plane API (https://trackit.implica.ru/api/v1/...)
```

## Build

```bash
npm install
npx expo export --platform web --output-dir dist
# Output: dist/ — static SPA
```

## Deploy

Static `dist/` mounts under nginx at `/widgets/trackit-stalk-app/` of stalk.implica.ru.
Configured via element-html-patches CM (`html-patches` mount) or separate widget-server pod.

## Auth

Parent (sTalk) passes Keycloak access_token to iframe via `postMessage`:

```js
// sTalk side (parent):
iframe.contentWindow.postMessage({
    type: "stalk:trackit:auth",
    access_token: keycloakAccessToken,
}, "https://stalk.implica.ru");

// trackit-stalk-app side (child):
window.addEventListener("message", (e) => {
    if (e.origin !== "https://stalk.implica.ru") return;
    if (e.data?.type === "stalk:trackit:auth") {
        // Exchange KC token for Plane session via /api/v1/mobile/auth/oidc/
        exchangeStalkSession(e.data.access_token);
    }
});
```

## Deviations from trackit-mobile

| Mobile (RN) | Web (this fork) |
| --- | --- |
| `expo-secure-store` | `localStorage` (lib/storage-web.ts) |
| `@react-native-async-storage/async-storage` | `localStorage` |
| `expo-notifications` (FCM/APNs) | Browser Notification API or skip |
| `expo-haptics` | no-op |
| `expo-image-picker` | `<input type="file">` |
| Direct grant Keycloak login | parent postMessage SSO from sTalk |

## TODO

- [ ] Replace `expo-secure-store` imports → `lib/storage-web.ts`
- [ ] Replace `AsyncStorage` imports → same web storage abstraction
- [ ] Auth context — listen for parent postMessage instead of email/password form
- [ ] Remove RN-only screens (push notifications setup, native iOS-specific flows)
- [ ] Test `npx expo export --platform web` builds without errors
- [ ] CI (gitea actions): build static, deploy to /widgets/ pod via kubectl
- [ ] sTalk integration: AppsList config entry pointing iframe to `/widgets/trackit-stalk-app/`
