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

	// Make the whole theme card clickable and keyboard-activatable
	const menuAction = document.querySelector(".project-card.menu-action");
	if (menuAction) {
		// reflect initial pressed state
		menuAction.setAttribute(
			"aria-pressed",
			switchEl.checked ? "true" : "false",
		);

		menuAction.addEventListener("click", (ev) => {
			// avoid double-toggle when clicking the inner label/input
			if (
				ev.target.closest &&
				(ev.target.closest('label[for="theme-switch"]') ||
					ev.target.closest("input#theme-switch"))
			)
				return;
			switchEl.checked = !switchEl.checked;
			applyTheme(switchEl.checked ? "dark" : "light");
		});

		menuAction.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				switchEl.checked = !switchEl.checked;
				applyTheme(switchEl.checked ? "dark" : "light");
			}
		});
	}
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

// Menu projects: open a modal with project details (coming soon)
(function () {
	const menuContent = document.querySelector(".menu-content");
	if (!menuContent) return;

	// modal elements
	const modalEl = document.getElementById("project-modal");
	const modalOverlay = document.getElementById("project-modal-overlay");
	const modalTitleEl = document.getElementById("project-modal-title");
	const modalSubtitleEl = document.getElementById("project-modal-subtitle");
	const modalDescEl = document.getElementById("project-modal-desc");
	const modalFeaturesEl = document.getElementById("project-modal-features");
	const modalCloseBtn = document.getElementById("project-modal-close");
	const modalOkBtn = document.getElementById("modal-ok");

	function openProjectModal(name, title) {
		if (!modalEl) return;
		modalTitleEl && (modalTitleEl.textContent = title || "Info");

		// defaults
		let subtitle = "Coming soon";
		let desc =
			"We are working on this feature and will share updates soon. Coming soon — stay tuned!";
		let features = [];

		if (name === "wavv-pro") {
			subtitle = "Advanced monitoring & reporting";
			desc =
				"Wavv Pro will bring more accurate measurements, historical charts and alerting — designed for power users and small teams. Coming soon — stay tuned!";
			features = [
				"Upload test (precise measurement)",
				"Historical results with CSV export",
				"Alerts via email or Telegram",
				"Selectable regional test servers",
			];
		} else if (name === "mobile-app") {
			subtitle = "PWA — mobile first";
			desc =
				"Mobile App will provide an installable, optimized interface for phones with quick tests and saved results for on-the-go diagnostics. Coming soon — stay tuned!";
			features = [
				"Installable PWA for home-screen use",
				"Compact UI and large touch targets",
				"Local results cache and history",
				"Optional push notifications (opt-in)",
			];
		} else {
			if (name === "about") {
				subtitle = "About Wavv Lite";
				// English description for About
				desc = `
					<p>Wavv Lite is a lightweight network test that runs entirely in your browser. We measure latency, jitter and download speed.</p>
					<p><strong>How it works:</strong> your browser downloads small files from public servers — we infer speed and timing from those transfers. No software is installed on your computer.</p>
					<p><strong>Privacy:</strong> we do not collect or send your personal data. Test results remain in your browser and are not uploaded to our servers.</p>
					<p>If you have any questions, contact us and we will explain in plain terms.</p>
					`;
				features = [
					"Measures latency and download speed",
					"No accounts or passwords required",
					"Results are not sent without your consent",
					"Runs in the browser — no installation required",
				];
			} else {
				// fallback: reuse card description if available
				const card = menuContent.querySelector(`[data-project="${name}"]`);
				if (card) {
					const d = card.querySelector(".project-desc");
					if (d) desc = d.textContent.trim();
				}
			}
		}

		if (modalSubtitleEl) modalSubtitleEl.textContent = subtitle;
		if (modalDescEl) {
			// allow HTML for longer explanatory text (we control the content)
			modalDescEl.innerHTML = desc;
		}
		if (modalFeaturesEl) {
			if (features.length > 0) {
				modalFeaturesEl.innerHTML = features
					.map((f) => `<li>${f}</li>`)
					.join("");
				modalFeaturesEl.setAttribute("aria-hidden", "false");
			} else {
				modalFeaturesEl.innerHTML = "";
				modalFeaturesEl.setAttribute("aria-hidden", "true");
			}
		}

		// prevent layout shift when scrollbar disappears: add right padding equal to scrollbar width
		const scrollbarComp =
			window.innerWidth - document.documentElement.clientWidth;
		// If HTML explicitly reserves the scrollbar (via CSS `overflow-y: scroll`),
		// don't add extra padding — that would cause a horizontal shift.
		const htmlOverflowY = getComputedStyle(document.documentElement).overflowY;
		if (scrollbarComp > 0 && htmlOverflowY !== "scroll") {
			document.body.style.paddingRight = `${scrollbarComp}px`;
		}

		// show modal and play opening animation
		modalEl.classList.remove("project-modal--closing");
		modalEl.classList.add("project-modal--opening");
		modalEl.setAttribute("aria-hidden", "false");
		document.body.classList.add("modal-open");
		// focus after a short delay so animation starts
		setTimeout(() => {
			if (modalCloseBtn) modalCloseBtn.focus();
		}, 50);

		// cleanup opening class after animation
		const onOpenEnd = (e) => {
			if (e.target !== modalEl.querySelector(".project-modal-content")) return;
			modalEl.classList.remove("project-modal--opening");
			modalEl.removeEventListener("animationend", onOpenEnd);
		};
		modalEl.addEventListener("animationend", onOpenEnd);
	}

	function closeProjectModal() {
		if (!modalEl) return;
		// If currently opening, remove that state
		modalEl.classList.remove("project-modal--opening");
		// add closing class to play animation, then actually hide
		modalEl.classList.add("project-modal--closing");
		const onCloseEnd = (e) => {
			if (e.target !== modalEl.querySelector(".project-modal-content")) return;
			modalEl.classList.remove("project-modal--closing");
			modalEl.setAttribute("aria-hidden", "true");
			document.body.classList.remove("modal-open");
			// remove scrollbar compensation
			document.body.style.paddingRight = "";
			modalEl.removeEventListener("animationend", onCloseEnd);
		};
		modalEl.addEventListener("animationend", onCloseEnd);
	}

	// modal event handlers
	if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeProjectModal);
	if (modalOkBtn) modalOkBtn.addEventListener("click", closeProjectModal);
	if (modalOverlay) modalOverlay.addEventListener("click", closeProjectModal);
	window.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeProjectModal();
	});

	function handleProjectActivation(name, title) {
		// close menu
		document.body.classList.remove("menu-open");
		const burger = document.getElementById("burger-btn");
		if (burger) burger.setAttribute("aria-expanded", "false");
		const menu = document.getElementById("side-menu");
		if (menu) menu.setAttribute("aria-hidden", "true");

		openProjectModal(name, title);
	}

	menuContent.addEventListener("click", (e) => {
		const card = e.target.closest && e.target.closest(".project-card");
		if (!card) return;
		if (card.classList && card.classList.contains("menu-action")) return;
		const name = card.getAttribute("data-project");
		const titleEl = card.querySelector(".project-title");
		const title = titleEl ? titleEl.textContent.trim() : name;
		handleProjectActivation(name, title);
	});

	menuContent.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		const card = e.target.closest && e.target.closest(".project-card");
		if (!card) return;
		if (card.classList && card.classList.contains("menu-action")) return;
		e.preventDefault();
		const name = card.getAttribute("data-project");
		const titleEl = card.querySelector(".project-title");
		const title = titleEl ? titleEl.textContent.trim() : name;
		handleProjectActivation(name, title);
	});
})();
