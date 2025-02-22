module.exports = {
	purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
	darkMode: false,
	theme: {
		screens: {
			'sm': {'min': '200px', 'max': '769px'},
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1536px',
			'3xl': { 'max': '1536px' },
		},
		extend: {},
	},
	variants: {},
	plugins: [],
}
