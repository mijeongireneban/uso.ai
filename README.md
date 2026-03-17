<div align="center">

<img width="64" height="64" alt="uso.ai logo" src="src-tauri/icons/icon.png" />

**uso.ai — AI usage dashboard for your menu bar.**

See how much Claude, ChatGPT, and Cursor quota you've used — without opening a browser.

[Features](#features) • [Install](#install) • [Setup](#setup) • [Contributing](#contributing)

</div>

![uso.ai demo](docs/assets/demo.png)

---

## Features

- **Menu bar popup** — click the `u` icon or press `⌘⇧U` to open your dashboard instantly
- **Claude, ChatGPT (Codex), Cursor** — all your AI subscriptions in one place
- **Multiple accounts** — track personal and work accounts for the same service side by side
- **Next reset countdown** — know exactly when your quota refreshes
- **Token expiry warnings** — desktop notifications before your session tokens expire
- **Light / Dark / System theme** — follows your macOS appearance
- **Auto-refresh** — updates every 5 minutes in the background
- **Private by default** — credentials stored locally only, never sent anywhere

---

## Install

1. Download the latest `uso.ai_x.x.x_universal.dmg` from [Releases](https://github.com/mijeongireneban/uso.ai/releases)
2. Open the `.dmg` and drag **uso.ai** to Applications
3. **First launch:** macOS will block the app since it's unsigned — right-click `uso.ai` → **Open** → **Open**. You only need to do this once.
4. uso.ai appears in your **menu bar** — no Dock icon

**Requires:** macOS 12+, Apple Silicon or Intel

---

## Setup

Go to **Settings** and add your session token for each service:

| Service | Credential |
|---|---|
| Claude | Organization ID + Session Key |
| ChatGPT (Codex) | Bearer Token |
| Cursor | Session Token |

You can add multiple accounts per service — useful if you have a personal and work subscription.

---

## Usage

| Action | How |
|---|---|
| Open / close | Click `u` in the menu bar, or `⌘⇧U` |
| Refresh | Click the refresh icon in the popup |
| Quit | Right-click `u` → **Quit uso.ai** |

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

```bash
git clone https://github.com/mijeongireneban/uso.ai.git
cd uso.ai
npm install
npm run tauri dev
```

---

## License

MIT

---

<div align="center">

[Releases](https://github.com/mijeongireneban/uso.ai/releases) • [Issues](https://github.com/mijeongireneban/uso.ai/issues)

</div>
