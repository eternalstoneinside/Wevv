// Wavv Utilities
const Utils = {
	// Функція паузи (чекаємо ms мілісекунд)
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

	// Функція для отримання випадкового числа (знадобиться для кеш-бастінгу)
	getRandomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

	// Середнє арифметичне масиву
	getAverage: (arr) => {
		if (arr.length === 0) return 0;
		const sum = arr.reduce((a, b) => a + b, 0);
		return sum / arr.length;
	},
};
