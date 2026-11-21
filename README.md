# Turf Hub

Turf Hub is a football turf booking platform for iOS and Android. It provides live pitch slot availability, BDT pricing, mobile checkout, user bookings, and an admin revenue dashboard.

> This project was created while testing the capability of Gemini Hydrogen 4 on AI Studio.

## Features

- Browse and search available football turfs
- View turfs on an interactive Google Maps interface
- Check live slot availability
- Reserve and manage bookings
- Mobile payment options for bKash, Nagad, and Rocket
- Sign in with email/password or Google
- Manage turfs and view revenue as an administrator
- Installable PWA experience with offline support

## Tech Stack

- React 19 and TypeScript
- Vite
- Firebase Authentication and Firestore
- Google Maps Platform
- Vite PWA

## Getting Started

### Prerequisites

- Node.js
- A Firebase project
- A Google Maps API key

### Installation

```bash
npm install
```

Copy `.env.example` to `.env` and add your API keys. Firebase configuration is stored in `firebase-applet-config.json`.

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Type Check

```bash
npm run lint
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
