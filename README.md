# Workout Tracker

A Progressive Web App for tracking workouts, routines, and fitness progress. Built with vanilla HTML, CSS, and JavaScript with an Apple-inspired design.

## Features

- **Quick Workout Entry** — Log exercises with sets/reps/weight or cardio duration/distance
- **Routines** — Create and manage workout templates for one-tap starts
- **Calendar View** — Monthly calendar with workout indicators and streak tracking
- **Progress & Stats** — Weight progression charts, volume trends, and personal records
- **Workout History** — Browse and repeat past workouts
- **Offline Support** — Full PWA with service worker caching
- **Dark Mode** — Automatic light/dark theme based on system preference

## Getting Started

Serve the files with any static server. For GitHub Pages, deploy from the `main` branch.

```
# Local development
npx serve .
```

Then open `http://localhost:3000` in your browser.

## Install as App

On iOS Safari, tap **Share → Add to Home Screen** to install as a standalone app.

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- LocalStorage for data persistence
- Service Worker for offline caching
- Canvas API for charts
