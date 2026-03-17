# uso.ai

**Track your AI subscription usage — right from the menu bar.**

uso.ai is a free, open-source macOS app that shows you how much of your Claude, ChatGPT (Codex), and Cursor quota you've used — without opening a browser.

---

## Features

- **Menu bar popup** — click the `u` icon or press `⌘⇧U` to instantly see your usage
- **Claude, ChatGPT (Codex), Cursor** — all in one place
- **Multiple accounts** — track personal and work accounts for the same service side by side
- **Next reset countdown** — know exactly when your quota refreshes
- **Token expiry warnings** — desktop notifications before your session tokens expire
- **Light / Dark / System theme** — follows your macOS appearance
- **Auto-refresh** — updates every 5 minutes in the background
- **Private by default** — credentials are stored locally only, never synced to any server

---

## Install

1. Download the latest `uso.ai_x.x.x_universal.dmg` from [Releases](https://github.com/mijeongireneban/uso.ai/releases)
2. Open the `.dmg` and drag **uso.ai** to your Applications folder
3. **First launch:** macOS will block the app since it's unsigned — right-click `uso.ai` in Applications → **Open** → click **Open** in the dialog. You only need to do this once.
4. uso.ai appears in your **menu bar** — no Dock icon.

### Requirements

- macOS 12 or later
- Apple Silicon or Intel Mac (universal binary)

---

## Setup

Open uso.ai and go to **Settings**. Add your session tokens for each service you want to track:

| Service | Credential needed |
|---|---|
| Claude | Organization ID + Session Key |
| ChatGPT (Codex) | Bearer Token |
| Cursor | Session Token |

You can add multiple accounts per service — useful if you have a personal and a work subscription.

---

## Usage

| Action | How |
|---|---|
| Open / close popup | Click `u` in the menu bar, or press `⌘⇧U` |
| Refresh usage data | Click the refresh icon in the popup |
| Quit | Right-click `u` in the menu bar → **Quit uso.ai** |

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
