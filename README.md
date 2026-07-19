# Wevv

A lightweight browser-based network speed and connection stability test.

[Live demo](https://eternalstoneinside.github.io/Wevv/)

## Overview

Wevv measures latency, jitter, and download performance directly in the browser. The interface is intentionally compact and mobile-friendly, making the project useful as a quick diagnostic tool and a demonstration of streaming browser APIs.

## Highlights

- Latency and jitter measurements
- Streaming download-speed test
- Public API-based IP, provider, and location information
- Responsive mobile-first interface
- Graceful fallbacks for unavailable or rate-limited APIs
- Installable web-app metadata and branded icons

## Tech stack

HTML5 · CSS3 · JavaScript · Fetch API · Streams API

## Run locally

```bash
git clone https://github.com/eternalstoneinside/Wevv.git
cd Wevv
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Network results can vary because the test relies on the browser, connection conditions, and third-party endpoints.

## Project structure

```text
index.html       Interface structure
css/style.css    Responsive styling
js/engine.js     Network measurements
js/main.js       UI orchestration
js/utils.js      Shared helpers
assets/          Icons and web-app metadata
```

## Author

Designed and developed by [Dmytro Orlenko](https://github.com/eternalstoneinside).
