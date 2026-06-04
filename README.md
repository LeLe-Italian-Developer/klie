# Klie

**Klie** is an AI character chat desktop app with local AI inference, offline support, and a creator ecosystem — available on macOS, Windows, Linux, and Android.

> ⚠️ **This repository contains the frontend source code only.**
> The backend API is proprietary and not included here.

---

## ✨ Features

- 🤖 **Local AI inference** — run models directly on your device, no cloud required
- 💬 **Character chat** — talk with richly defined AI characters
- 🌍 **World building** — create immersive scenarios with locations and lore
- 🔒 **Offline mode** — hardware-locked license for up to 7 days without internet
- 📦 **Cross-platform** — macOS (Intel + Apple Silicon), Windows, Linux, Android

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion + GSAP |
| Monorepo | pnpm workspaces + Turborepo |

---

## 📦 Download

Pre-built binaries are available in [Releases](https://github.com/gabrielegiannino/klie/releases):

| Platform | Format |
|---|---|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x86_64) |
| Windows | `.exe` NSIS installer |
| Linux | `.AppImage` |
| Android | `.apk` |

---

## 🏗 Build from Source

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [pnpm 10+](https://pnpm.io)
- [Rust stable](https://rustup.rs)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

### Setup

```bash
# Clone the repo
git clone https://github.com/gabrielegiannino/klie.git
cd klie

# Copy env template
cp .env.example apps/desktop/.env

# Edit apps/desktop/.env and set VITE_API_URL

# Install dependencies
pnpm install

# Start dev server
cd apps/desktop
pnpm tauri dev
```

### Build release

```bash
cd apps/desktop
pnpm tauri build
```

---

## 📁 Project Structure

```
klie/
├── apps/
│   └── desktop/          # Tauri + React desktop app
│       ├── src/          # React frontend (TypeScript)
│       └── src-tauri/    # Rust backend (Tauri commands)
├── packages/
│   └── ui/               # Shared UI component library
├── .env.example          # Environment variable template
└── LICENSE               # GPL v3
```

---

## 🐛 Issues

Found a bug? [Open an issue](https://github.com/gabrielegiannino/klie/issues/new/choose).

> **Note:** This repository accepts issues only. Pull requests are not accepted.

---

## 🔒 Security

See [SECURITY.md](./SECURITY.md) to report vulnerabilities responsibly.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see [LICENSE](./LICENSE) for details.

GPL v3 guarantees that any distributed modifications must remain open source under the same license.
