class WavvEngine {
	constructor() {
		// Використовуємо Cloudflare для пінгу та тестового файлу
		this.pingUrl = "https://1.1.1.1/cdn-cgi/trace";
		this.downloadUrl = "https://speed.cloudflare.com/__down?bytes=52428800"; // 50MB
		this.results = {
			latency: 0,
			jitter: 0,
			downloadSpeed: 0,
			rawPings: [],
		};
	}

	// --- ТЕСТ ЛАТЕНСІ (ВЖЕ ПЕРЕВІРЕНИЙ ТОБОЮ) ---
	async runLatencyTest(iterations = 10, onProgress) {
		this.results.rawPings = [];

		for (let i = 0; i < iterations; i++) {
			const startTime = performance.now();

			try {
				const cacheBuster = `?z=${Utils.getRandomInt(1000, 9999)}`;
				await fetch(this.pingUrl + cacheBuster, {
					mode: "no-cors",
					cache: "no-store",
				});

				const endTime = performance.now();
				const pingTime = endTime - startTime;
				this.results.rawPings.push(pingTime);

				if (onProgress) onProgress(i + 1, iterations, pingTime);
			} catch (error) {
				console.error("Ping failed", error);
			}
			await Utils.sleep(100);
		}

		this.calculateStats();
		return this.results;
	}

	// --- НОВИЙ ТЕСТ ЗАВАНТАЖЕННЯ (DOWNLOAD) ---
	async runSmartDownloadTest(onProgress, config = {}) {
		// Configurable parameters with sensible defaults
		const defaults = {
			probeBytes: 1 * 1024 * 1024, // 1 MB
			probeTimeout: 5000, // ms
			fastThresholdMs: 500, // 0.5s
			slowThresholdMs: 2000, // 2s
			fastMainBytes: 50 * 1024 * 1024, // 50MB
			mediumMainBytes: 15 * 1024 * 1024, // 15MB
			slowMainBytes: 2.5 * 1024 * 1024, // 2.5MB
			mainTimeout: 10000, // ms
			overallTimeout: 15000, // ms
		};
		const cfg = Object.assign({}, defaults, config);

		// Helper to build download URL for requested byte size
		const getUrlForSize = (size) => {
			const base = this.downloadUrl.split("?")[0];
			return `${base}?bytes=${Math.floor(size)}`;
		};

		// Generic download routine: tries fetch streams, falls back to XHR
		const downloadOnce = async (url, opts = {}) => {
			// opts: maxBytes, maxDuration (ms), onChunk(loaded, totalRequested, elapsedMs)
			const maxBytes = opts.maxBytes || Infinity;
			const maxDuration = opts.maxDuration || Infinity;
			const onChunk =
				typeof opts.onChunk === "function" ? opts.onChunk : () => {};

			// Try fetch + streams
			try {
				const controller = new AbortController();
				const start = performance.now();
				const resp = await fetch(url + `&cb=${Math.random()}`, {
					cache: "no-store",
					signal: controller.signal,
				});

				if (resp.body && resp.body.getReader) {
					const reader = resp.body.getReader();
					let loaded = 0;

					while (true) {
						const now = performance.now();
						const elapsed = now - start;
						if (elapsed >= maxDuration) {
							controller.abort();
							break;
						}

						const { done, value } = await reader.read();
						if (done) break;
						loaded += value.length;
						onChunk(loaded, maxBytes, elapsed);

						if (loaded >= maxBytes) {
							controller.abort();
							break;
						}
					}

					const end = performance.now();
					return { loaded: Math.min(maxBytes, loaded), elapsedMs: end - start };
				}
			} catch (err) {
				// fallthrough to XHR
				console.warn(
					"Fetch streaming failed, will try XHR fallback",
					err && err.name ? err.name : err,
				);
			}

			// XHR fallback
			return await new Promise((resolve) => {
				try {
					const xhr = new XMLHttpRequest();
					let loaded = 0;
					const start = performance.now();
					xhr.open("GET", url + `&cb=${Math.random()}`, true);
					xhr.responseType = "arraybuffer";
					xhr.timeout = Math.max(30000, maxDuration);

					xhr.onprogress = (e) => {
						loaded = e.loaded || loaded;
						onChunk(loaded, maxBytes, performance.now() - start);
						if (loaded >= maxBytes) {
							xhr.abort();
						}
					};

					xhr.onloadend = () => {
						const end = performance.now();
						resolve({
							loaded: Math.min(maxBytes, loaded),
							elapsedMs: end - start,
						});
					};

					xhr.onerror = () => {
						resolve({
							loaded: Math.min(maxBytes, loaded),
							elapsedMs: performance.now() - start,
						});
					};

					// safety timeout
					const to = setTimeout(() => {
						try {
							xhr.abort();
						} catch (e) {}
					}, maxDuration + 200);

					xhr.send();
				} catch (e) {
					resolve({ loaded: 0, elapsedMs: 0 });
				}
			});
		};

		// Start probe phase
		const probeUrl = getUrlForSize(cfg.probeBytes);
		const probeRes = await downloadOnce(probeUrl, {
			maxBytes: cfg.probeBytes,
			maxDuration: cfg.probeTimeout,
			onChunk: (loaded, totalRequested, elapsed) => {
				if (onProgress)
					onProgress({
						phase: "probe",
						loaded,
						totalRequested,
						elapsedMs: elapsed,
					});
			},
		});

		const probeTime = probeRes.elapsedMs;

		// Classify
		let mainTarget = cfg.mediumMainBytes;
		if (probeTime < cfg.fastThresholdMs) mainTarget = cfg.fastMainBytes;
		else if (probeTime > cfg.slowThresholdMs) mainTarget = cfg.slowMainBytes;

		// If very slow (probe > slowThreshold) — we may decide to not download big file
		if (probeTime > cfg.slowThresholdMs) {
			// Option: return result based on probe (converted to Mbps)
			const speedMbps =
				(probeRes.loaded * 8) /
				1000000 /
				Math.max(probeRes.elapsedMs / 1000, 0.001);
			this.results.downloadSpeed = speedMbps.toFixed(1);
			if (onProgress)
				onProgress({
					phase: "done",
					loaded: probeRes.loaded,
					totalRequested: cfg.probeBytes,
					elapsedMs: probeRes.elapsedMs,
				});
			return this.results.downloadSpeed;
		}

		// Main download phase (time-boxed)
		const mainUrl = getUrlForSize(mainTarget);
		const mainRes = await downloadOnce(mainUrl, {
			maxBytes: mainTarget,
			maxDuration: cfg.mainTimeout,
			onChunk: (loaded, totalRequested, elapsed) => {
				if (onProgress)
					onProgress({
						phase: "main",
						loaded,
						totalRequested,
						elapsedMs: elapsed,
					});
			},
		});

		// Calculate final speed from main (or combined)
		const usedBytes = mainRes.loaded || probeRes.loaded;
		const usedTime =
			mainRes.elapsedMs && mainRes.elapsedMs > 0
				? mainRes.elapsedMs
				: probeRes.elapsedMs;
		const finalMbps =
			(usedBytes * 8) / 1000000 / Math.max(usedTime / 1000, 0.001);
		this.results.downloadSpeed = finalMbps.toFixed(1);
		if (onProgress)
			onProgress({
				phase: "done",
				loaded: usedBytes,
				totalRequested: mainTarget,
				elapsedMs: usedTime,
			});
		return this.results.downloadSpeed;
	}

	// Математика для затримки
	calculateStats() {
		const pings = this.results.rawPings;
		this.results.latency = Utils.getAverage(pings);

		let jitterSum = 0;
		for (let i = 0; i < pings.length - 1; i++) {
			jitterSum += Math.abs(pings[i] - pings[i + 1]);
		}
		this.results.jitter = pings.length > 1 ? jitterSum / (pings.length - 1) : 0;
	}

	// Получить информацию о пользователе (IP / ISP / гео)
	async getUserInfo() {
		// Try multiple public APIs (with timeouts). Many public IP providers block
		// cross-origin requests (CORS) from static origins — that's expected.
		// To avoid noisy console warnings for expected network failures we:
		// 1) Prefer small CORS-friendly provider first (`api.ipify.org`)
		// 2) Fail silently for providers that error due to CORS or network issues
		//    (developers can enable `VERBOSE` for debugging).
		const VERBOSE = false;
		const providers = [
			{
				// lightweight CORS-friendly endpoint (returns { ip })
				url: "https://api.ipify.org?format=json",
				map: (d) => ({ ip: d.ip }),
			},
			{
				url: "https://ipwhois.app/json/",
				map: (d) => ({
					ip: d.ip,
					isp: d.isp || d.org,
					city: d.city,
					country: d.country,
				}),
			},
			{
				// ipapi is useful but often blocked by CORS on static origins
				url: "https://ipapi.co/json/",
				map: (d) => ({
					ip: d.ip,
					isp: d.org || d.org_name,
					city: d.city,
					country: d.country_name,
				}),
			},
		];

		let aggregate = {};

		for (const p of providers) {
			try {
				const controller = new AbortController();
				const t = setTimeout(() => controller.abort(), 5000);
				const res = await fetch(p.url, {
					signal: controller.signal,
					cache: "no-store",
				});
				clearTimeout(t);
				if (!res.ok) {
					if (VERBOSE) console.warn("Upstream responded", res.status, p.url);
					continue;
				}
				if (res.type === "opaque") {
					if (VERBOSE) console.debug("Opaque response (CORS) from", p.url);
					continue;
				}
				const data = await res.json();
				const mapped = p.map(data) || {};
				// Merge mapped fields into aggregate, preferring existing values
				for (const k of Object.keys(mapped)) {
					if (
						mapped[k] !== undefined &&
						mapped[k] !== null &&
						mapped[k] !== "" &&
						!(
							aggregate[k] &&
							aggregate[k] !== undefined &&
							aggregate[k] !== null
						)
					) {
						aggregate[k] = mapped[k];
					}
				}
				// If we have more than just IP, return early with richer data
				if (aggregate.isp || aggregate.city || aggregate.country) {
					return aggregate;
				}
			} catch (err) {
				if (VERBOSE)
					console.warn(
						"Provider failed",
						p.url,
						err && err.name ? err.name : err,
					);
				// continue to next provider
			}
		}

		// If at least IP was found, return it (even if other fields missing)
		if (aggregate.ip) return aggregate;

		return null;
	}
}
