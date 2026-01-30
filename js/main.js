// Знаходимо елементи інтерфейсу
const startBtn = document.getElementById("start-btn");
const statusText = document.getElementById("status-indicator");
const latencyDisplay = document.getElementById("latency-value");
const downloadDisplay = document.getElementById("download-value");
const progressBar = document.getElementById("progress-bar");

// Створюємо екземпляр двигуна
const engine = new WavvEngine();

// Theme toggle: сохраняет выбор в localStorage и применяет класс на body
(function () {
	const switchEl = document.getElementById("theme-switch");
	if (!switchEl) return;

	function applyTheme(theme) {
		document.body.classList.remove("theme-light", "theme-dark");
		document.body.classList.add(
			theme === "dark" ? "theme-dark" : "theme-light",
		);
		localStorage.setItem("site-theme", theme);
		// Устанавливаем состояние чекбокса и aria-атрибут
		try {
			switchEl.checked = theme === "dark";
			switchEl.setAttribute(
				"aria-checked",
				switchEl.checked ? "true" : "false",
			);
		} catch (e) {}
	}

	const saved = localStorage.getItem("site-theme");
	const systemDark =
		window.matchMedia &&
		window.matchMedia("(prefers-color-scheme: dark)").matches;
	const initial =
		saved === "dark" || saved === "light"
			? saved
			: systemDark
				? "dark"
				: "light";
	applyTheme(initial);

	switchEl.addEventListener("change", () => {
		applyTheme(switchEl.checked ? "dark" : "light");
	});
})();

// Menu (burger) open/close logic
(function () {
	const burger = document.getElementById("burger-btn");
	const menu = document.getElementById("side-menu");
	const overlay = document.getElementById("menu-overlay");
	const menuClose = document.getElementById("menu-close");
	if (!burger || !menu || !overlay) return;

	function openMenu() {
		document.body.classList.add("menu-open");
		burger.setAttribute("aria-expanded", "true");
		menu.setAttribute("aria-hidden", "false");
		overlay.hidden = false;
	}

	function closeMenu() {
		document.body.classList.remove("menu-open");
		burger.setAttribute("aria-expanded", "false");
		menu.setAttribute("aria-hidden", "true");
		overlay.hidden = true;
	}

	burger.addEventListener("click", () => {
		if (document.body.classList.contains("menu-open")) closeMenu();
		else openMenu();
	});

	overlay.addEventListener("click", closeMenu);
	if (menuClose) menuClose.addEventListener("click", closeMenu);

	// close on ESC
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeMenu();
	});
})();

startBtn.addEventListener("click", async () => {
	// 1. ПІДГОТОВКА
	startBtn.disabled = true;
	startBtn.innerText = "Testing...";
	progressBar.style.width = "0%";

	// Скидаємо старі значення
	const latencyMsEl = document.getElementById("latency-ms");
	const latencyJitterEl = document.getElementById("latency-jitter");
	if (latencyMsEl) latencyMsEl.innerHTML = `0 <small>ms</small>`;
	if (latencyJitterEl) latencyJitterEl.style.opacity = 0;
	downloadDisplay.innerHTML = `0 <small>Mbps</small>`;

	// 2. ТЕСТ LATENCY (ЗАТРИМКА)
	statusText.innerText = "Measuring Latency & Jitter...";

	const latencyResults = await engine.runLatencyTest(
		10,
		(current, total, lastPing) => {
			const percent = (current / total) * 100;
			// На першому етапі смужка заповнюється на 50%
			progressBar.style.width = `${percent / 2}%`;
			const msEl = document.getElementById("latency-ms");
			if (msEl) msEl.innerHTML = `${lastPing.toFixed(0)} <small>ms</small>`;
		},
	);

	// Фіксуємо фінальні результати затримки
	const msFinal = document.getElementById("latency-ms");
	if (msFinal)
		msFinal.innerHTML = `${latencyResults.latency.toFixed(1)} <small>ms</small>`;
	if (latencyJitterEl) {
		latencyJitterEl.textContent = `Jitter: ±${latencyResults.jitter.toFixed(1)} ms`;
		latencyJitterEl.style.opacity = 1;
	}

	// Маленька пауза для візуального переходу
	await Utils.sleep(500);

	// 3. ТЕСТ DOWNLOAD (ШВИДКІСТЬ) — використаємо розумний фазовий тест з probe
	statusText.innerText = "Measuring download speed...";

	let prevLoaded = 0;
	let prevTime = 0;
	let ema = null;
	const alpha = 0.18; // EMA коэффициент (меньше — плавнее)
	const updateThrottleMs = 300; // минимум между обновлениями DOM скорости
	let lastSpeedUpdate = 0;

	const speed = await engine.runSmartDownloadTest((info) => {
		// info: { phase: 'probe'|'main'|'done', loaded, totalRequested, elapsedMs }
		if (!info) return;

		if (info.phase === "probe") {
			const pct = Math.min(info.loaded / info.totalRequested, 1);
			// probe occupies a small slice after latency (which ends at 50%)
			const probeSpan = 15; // percent of bar used for probe (50%->65%)
			progressBar.style.width = `${50 + pct * probeSpan}%`;
			statusText.innerText = `Probing: ${Math.round(pct * 100)}%`;
			return;
		}

		if (info.phase === "main") {
			const pct = Math.min(info.loaded / info.totalRequested, 1);
			// main fills remaining bar after probe
			const probeSpan = 15; // must match probeSpan above
			const mainSpan = 50 - probeSpan; // remaining percent (to reach 100)
			progressBar.style.width = `${50 + probeSpan + pct * mainSpan}%`;

			// Рассчитываем мгновенную скорость по дельте
			if (prevTime > 0) {
				const deltaBytes = info.loaded - prevLoaded;
				const deltaSec = Math.max((info.elapsedMs - prevTime) / 1000, 0.001);
				const instMbps = (deltaBytes * 8) / 1000000 / deltaSec;
				ema = ema !== null ? alpha * instMbps + (1 - alpha) * ema : instMbps;
				// Обновляем DOM не чаще, чем updateThrottleMs
				const now = performance.now();
				if (now - lastSpeedUpdate >= updateThrottleMs) {
					downloadDisplay.innerHTML = `${ema.toFixed(1)} <small>Mbps</small>`;
					lastSpeedUpdate = now;
				}
				statusText.innerText = `Downloading: ${Math.round(pct * 100)}%`;
			} else {
				statusText.innerText = `Downloading...`;
			}

			prevLoaded = info.loaded;
			prevTime = info.elapsedMs;
			return;
		}

		if (info.phase === "done") {
			// Финальный вывод будет после возврата из runSmartDownloadTest
			progressBar.style.width = `100%`;
			statusText.innerText = `Finishing...`;
			return;
		}
	});

	// Виводимо фінальну швидкість
	downloadDisplay.innerHTML = `${speed} <small>Mbps</small>`;

	// 4. COMPLETION
	statusText.innerText = "TEST COMPLETE";
	statusText.style.color = "#007bff";
	startBtn.innerText = "Run again";
	startBtn.disabled = false;
	progressBar.style.width = "100%";
});

// Функція для відображення інфо при завантаженні
window.addEventListener("load", async () => {
	const info = await engine.getUserInfo();
	if (info) {
		document.getElementById("user-ip").innerText = info.ip || "—";
		document.getElementById("user-isp").innerText = info.isp || "—";
		const city = info.city || "";
		const country = info.country || "";
		const locText =
			city && country ? `${city}, ${country}` : city || country || "—";
		document.getElementById("user-loc").innerText = locText;
	} else {
		document.getElementById("info-bar").innerText =
			"Unable to retrieve network info";
	}
});
