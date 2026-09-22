/**
 * Every action is one URL against the app's Control API.
 *
 * Things are addressed by the NAME you gave them in StreamGraphics Pro, not by an
 * internal id, so a button keeps working after the show file is rebuilt. The
 * dropdowns are filled from live state, and every one of them also accepts a typed
 * value so variables like $(internal:custom_court) work.
 */

const q = (s) => encodeURIComponent(String(s ?? ''))

export function updateActions(self) {
	const presets = self.choices.presets
	const boards = self.choices.scoreboards
	const marks = self.choices.marks
	const scripts = self.choices.scripts ?? []

	const presetField = {
		type: 'dropdown',
		label: 'Library preset',
		id: 'name',
		default: presets[0]?.id ?? '',
		choices: presets,
		allowCustom: true,
		tooltip: 'The name as it appears in the Show Library',
	}
	const boardField = {
		type: 'dropdown',
		label: 'Scoreboard',
		id: 'name',
		default: boards[0]?.id ?? '',
		choices: boards,
		allowCustom: true,
		tooltip: 'Leave blank to use the first scoreboard',
	}
	const teamField = {
		type: 'dropdown',
		label: 'Team',
		id: 'team',
		default: '1',
		choices: [
			{ id: '1', label: 'Team 1 (top row)' },
			{ id: '2', label: 'Team 2 (bottom row)' },
		],
	}

	const layerField = {
		type: 'textinput',
		label: 'Bullets layer (optional)',
		id: 'layer',
		default: '',
		useVariables: true,
		tooltip: 'Only needed when one graphic holds more than one bullet list — type the layer name. Blank = the first one.',
	}

	// Resolve a dropdown that may hold a variable expression.
	const name = async (opt) => (await self.parseVariablesInString(String(opt ?? ''))).trim()
	const revealUrl = (cmd, preset, layer) =>
		`/api/bullets/${cmd}?preset=${q(preset)}` + (layer ? `&layer=${q(layer)}` : '')

	self.setActionDefinitions({
		// ---- Show Library ----
		preset_on: {
			name: 'Library preset: on air',
			options: [presetField],
			callback: async (a) => self.command(`/api/preset/on?name=${q(await name(a.options.name))}`),
		},
		preset_off: {
			name: 'Library preset: off air',
			options: [presetField],
			callback: async (a) => self.command(`/api/preset/off?name=${q(await name(a.options.name))}`),
		},
		preset_toggle: {
			name: 'Library preset: toggle',
			options: [presetField],
			callback: async (a) => self.command(`/api/preset/toggle?name=${q(await name(a.options.name))}`),
		},
		preset_alloff: {
			name: 'Library preset: ALL off air',
			options: [],
			callback: async () => self.command('/api/preset/alloff'),
		},
		preset_next: {
			name: 'Library preset: next spreadsheet row',
			options: [presetField],
			callback: async (a) => self.command(`/api/preset/next?name=${q(await name(a.options.name))}`),
		},
		preset_prev: {
			name: 'Library preset: previous spreadsheet row',
			options: [presetField],
			callback: async (a) => self.command(`/api/preset/prev?name=${q(await name(a.options.name))}`),
		},
		preset_row: {
			name: 'Library preset: go to spreadsheet row',
			options: [
				presetField,
				{ type: 'textinput', label: 'Row number (1 = first)', id: 'n', default: '1', useVariables: true },
			],
			callback: async (a) => {
				const n = parseInt(await self.parseVariablesInString(String(a.options.n ?? '1')), 10) || 1
				return self.command(`/api/preset/row?name=${q(await name(a.options.name))}&n=${n}`)
			},
		},
		// What happens BETWEEN one row and the next. Stepping a deck does not need this — the
		// style is a property of the deck — but setting it from a button lets one section of a
		// show dip to black while the rest cross fades.
		preset_change: {
			name: 'Library preset: set the change style (cross fade, dip to colour, slide)',
			options: [
				presetField,
				{
					type: 'dropdown',
					label: 'Between rows',
					id: 'mode',
					default: 'crossfade',
					choices: [
						{ id: 'crossfade', label: 'Cross fade' },
						{ id: 'fadeblack', label: 'Fade through black' },
						{ id: 'fadewhite', label: 'Fade through white' },
						{ id: 'pushleft', label: 'Slide left' },
						{ id: 'pushright', label: 'Slide right' },
						{ id: 'cut', label: 'Cut (shows the background for a frame)' },
						{ id: 'reanimate', label: 'Off then on (shows the background)' },
					],
					tooltip: 'The first five keep a picture on screen the whole way through the change',
				},
			],
			callback: async (a) =>
				self.command(`/api/preset/change?name=${q(await name(a.options.name))}&mode=${q(a.options.mode)}`),
		},

		// ---- Bullet builds / slide decks inside a preset ----
		// The layer box is optional: leave it blank and the first bullets (or slides) layer in
		// the graphic is the one that steps, which is what a one-list graphic always wants.
		bullets_next: {
			name: 'Bullets: reveal the next point',
			options: [presetField, layerField],
			callback: async (a) => self.command(revealUrl('next', await name(a.options.name), await name(a.options.layer))),
		},
		bullets_prev: {
			name: 'Bullets: take the last point back',
			options: [presetField, layerField],
			callback: async (a) => self.command(revealUrl('prev', await name(a.options.name), await name(a.options.layer))),
		},
		bullets_first: {
			name: 'Bullets: back to the first point',
			options: [presetField, layerField],
			callback: async (a) => self.command(revealUrl('first', await name(a.options.name), await name(a.options.layer))),
		},
		bullets_all: {
			name: 'Bullets: reveal every point',
			options: [presetField, layerField],
			callback: async (a) => self.command(revealUrl('all', await name(a.options.name), await name(a.options.layer))),
		},
		bullets_blank: {
			name: 'Bullets: back to nothing revealed',
			options: [presetField, layerField],
			callback: async (a) => self.command(revealUrl('blank', await name(a.options.name), await name(a.options.layer))),
		},
		bullets_goto: {
			name: 'Bullets: jump to a point',
			options: [
				presetField,
				layerField,
				{ type: 'textinput', label: 'Point number (1 = first, 0 = blank)', id: 'n', default: '1', useVariables: true },
			],
			callback: async (a) => {
				const n = parseInt(await self.parseVariablesInString(String(a.options.n ?? '1')), 10)
				return self.command(
					revealUrl('goto', await name(a.options.name), await name(a.options.layer)) + `&n=${isNaN(n) ? 1 : n}`
				)
			},
		},

		// ---- Presenter timer ----
		timer_start: { name: 'Timer: start', options: [], callback: async () => self.command('/api/timer/start') },
		timer_pause: { name: 'Timer: pause', options: [], callback: async () => self.command('/api/timer/pause') },
		timer_reset: { name: 'Timer: reset', options: [], callback: async () => self.command('/api/timer/reset') },
		timer_air: { name: 'Timer: on air', options: [], callback: async () => self.command('/api/timer/air') },
		timer_off: { name: 'Timer: off air', options: [], callback: async () => self.command('/api/timer/off') },
		timer_set: {
			name: 'Timer: set countdown',
			options: [
				{
					type: 'textinput',
					label: 'Time as MM:SS (or HH:MM:SS)',
					id: 'mmss',
					default: '05:00',
					useVariables: true,
					tooltip: 'Sets the timer to count down from this',
				},
			],
			callback: async (a) => {
				const v = (await self.parseVariablesInString(String(a.options.mmss ?? ''))).trim()
				return self.command(`/api/timer/set?mmss=${q(v)}`)
			},
		},
		timer_adjust: {
			name: 'Timer: add or remove time',
			options: [
				{
					type: 'textinput',
					label: 'Seconds (negative to take time away)',
					id: 'seconds',
					default: '30',
					useVariables: true,
				},
			],
			callback: async (a) => {
				const v = parseFloat(await self.parseVariablesInString(String(a.options.seconds ?? '0'))) || 0
				return self.command(`/api/timer/adjust?seconds=${v}`)
			},
		},

		// ---- Scoreboards ----
		sb_point: {
			name: 'Scoreboard: score a point',
			options: [
				boardField,
				teamField,
				{
					type: 'textinput',
					label: 'Points (use -1 to take one back)',
					id: 'delta',
					default: '1',
					useVariables: true,
				},
			],
			callback: async (a) => {
				const d = parseInt(await self.parseVariablesInString(String(a.options.delta ?? '1')), 10)
				return self.command(
					`/api/scoreboard/point?name=${q(await name(a.options.name))}&team=${a.options.team}&delta=${isNaN(d) ? 1 : d}`
				)
			},
		},
		sb_show: {
			name: 'Scoreboard: on air',
			options: [boardField],
			callback: async (a) => self.command(`/api/scoreboard/show?name=${q(await name(a.options.name))}`),
		},
		sb_hide: {
			name: 'Scoreboard: off air',
			options: [boardField],
			callback: async (a) => self.command(`/api/scoreboard/hide?name=${q(await name(a.options.name))}`),
		},
		sb_nextgame: {
			name: 'Scoreboard: start next game / set',
			options: [boardField],
			callback: async (a) => self.command(`/api/scoreboard/nextgame?name=${q(await name(a.options.name))}`),
		},
		sb_restart: {
			name: 'Scoreboard: restart the match',
			options: [boardField],
			callback: async (a) => self.command(`/api/scoreboard/restart?name=${q(await name(a.options.name))}`),
		},

		// ---- Baseball / softball ----
		bl_run: {
			name: 'Baseball: score a run',
			options: [
				teamField,
				{ type: 'textinput', label: 'Runs', id: 'delta', default: '1', useVariables: true },
			],
			callback: async (a) => {
				const d = parseInt(await self.parseVariablesInString(String(a.options.delta ?? '1')), 10)
				return self.command(`/api/baseball/run?team=${a.options.team}&delta=${isNaN(d) ? 1 : d}`)
			},
		},
		bl_ball: { name: 'Baseball: ball', options: [], callback: async () => self.command('/api/baseball/ball') },
		bl_strike: { name: 'Baseball: strike', options: [], callback: async () => self.command('/api/baseball/strike') },
		bl_out: { name: 'Baseball: out', options: [], callback: async () => self.command('/api/baseball/out') },
		bl_clearcount: {
			name: 'Baseball: clear the count',
			options: [],
			callback: async () => self.command('/api/baseball/clearcount'),
		},
		bl_advance: {
			name: 'Baseball: advance half-inning',
			options: [],
			callback: async () => self.command('/api/baseball/advance'),
		},
		bl_show: { name: 'Baseball: on air', options: [], callback: async () => self.command('/api/baseball/show') },
		bl_hide: { name: 'Baseball: off air', options: [], callback: async () => self.command('/api/baseball/hide') },

		// ---- Teleprompter ----
		// Two separate ideas that are easy to confuse, so the names say which is which:
		// ON AIR / OFF AIR is whether the prompter is being shown at all, and ROLL / HOLD is
		// whether the script is moving. A presenter can be looking at a held script perfectly
		// happily, and stopping the scroll should never take their words off the screen.
		prompter_air: {
			name: 'Teleprompter: on air',
			options: [],
			callback: async () => self.command('/api/prompter/air'),
		},
		prompter_off: {
			name: 'Teleprompter: off air',
			options: [],
			callback: async () => self.command('/api/prompter/off'),
		},
		prompter_play: {
			name: 'Teleprompter: roll',
			options: [],
			callback: async () => self.command('/api/prompter/play'),
		},
		prompter_pause: {
			name: 'Teleprompter: hold',
			options: [],
			callback: async () => self.command('/api/prompter/pause'),
		},
		prompter_toggle: {
			name: 'Teleprompter: roll / hold',
			options: [],
			callback: async () => self.command('/api/prompter/toggle'),
		},
		prompter_faster: {
			name: 'Teleprompter: speed up',
			options: [
				{
					type: 'textinput',
					label: 'By how much',
					id: 'by',
					default: '5',
					useVariables: true,
					tooltip: 'Speed is in pixels a second, the same number the app shows. 5 is one nudge.',
				},
			],
			callback: async (a) => {
				const v = parseFloat(await self.parseVariablesInString(String(a.options.by ?? '5')))
				return self.command(`/api/prompter/faster?by=${isNaN(v) ? 5 : v}`)
			},
		},
		prompter_slower: {
			name: 'Teleprompter: slow down',
			options: [
				{ type: 'textinput', label: 'By how much', id: 'by', default: '5', useVariables: true },
			],
			callback: async (a) => {
				const v = parseFloat(await self.parseVariablesInString(String(a.options.by ?? '5')))
				return self.command(`/api/prompter/slower?by=${isNaN(v) ? 5 : v}`)
			},
		},
		prompter_speed: {
			name: 'Teleprompter: set the speed',
			options: [
				{
					type: 'textinput',
					label: 'Speed (pixels a second)',
					id: 'value',
					default: '60',
					useVariables: true,
					tooltip: 'Useful on a rehearsed show: one button that always returns to the speed you settled on',
				},
			],
			callback: async (a) => {
				const v = parseFloat(await self.parseVariablesInString(String(a.options.value ?? '')))
				if (isNaN(v)) return
				return self.command(`/api/prompter/speed?value=${v}`)
			},
		},
		prompter_back: {
			name: 'Teleprompter: nudge back',
			options: [],
			callback: async () => self.command('/api/prompter/back'),
		},
		prompter_ahead: {
			name: 'Teleprompter: nudge ahead',
			options: [],
			callback: async () => self.command('/api/prompter/ahead'),
		},
		prompter_top: {
			name: 'Teleprompter: back to the top',
			options: [],
			callback: async () => self.command('/api/prompter/top'),
		},
		prompter_nextmark: {
			name: 'Teleprompter: next bookmark',
			options: [],
			callback: async () => self.command('/api/prompter/nextmark'),
		},
		prompter_prevmark: {
			name: 'Teleprompter: previous bookmark',
			options: [],
			callback: async () => self.command('/api/prompter/prevmark'),
		},
		prompter_mark: {
			name: 'Teleprompter: jump to a bookmark',
			options: [
				{
					type: 'dropdown',
					label: 'Bookmark',
					id: 'name',
					default: marks[0]?.id ?? '',
					choices: marks,
					allowCustom: true,
					// 🚨 By NAME on purpose. A script gets rewritten an hour before the show and every
					// section shifts position; addressing by number would silently send the button to
					// the wrong part of the script, which is the worst kind of wrong on air.
					tooltip: 'The heading as written in the script. It keeps working after the script is rewritten.',
				},
			],
			callback: async (a) => {
				const nm = await name(a.options.name)
				if (!nm) return
				return self.command(`/api/prompter/mark?name=${q(nm)}`)
			},
		},
		prompter_script: {
			name: 'Teleprompter: load a saved script',
			options: [
				{
					type: 'dropdown',
					label: 'Saved script',
					id: 'name',
					default: scripts[0]?.id ?? '',
					choices: scripts,
					allowCustom: true,
					// 🚨 By NAME, like everything else here. The list is what the operator saved in
					// the app, so a button built today still points at the right script next week.
					tooltip: 'The name you saved it under in the app. One button per segment works well.',
				},
			],
			callback: async (a) => {
				const nm = await name(a.options.name)
				if (!nm) return
				/* Deliberately NOT silent on a bad name. The app answers 404 and lists what it does
				 * have, and self.command surfaces that in the log — a button that quietly does
				 * nothing mid-show is the worst possible failure for this particular action. */
				return self.command(`/api/prompter/script?name=${q(nm)}`)
			},
		},
		prompter_mark_n: {
			name: 'Teleprompter: jump to bookmark by number',
			options: [
				{
					type: 'textinput',
					label: 'Bookmark number (1 = first)',
					id: 'n',
					default: '1',
					useVariables: true,
					tooltip: 'Use this only when the script is fixed. Otherwise jump by name.',
				},
			],
			callback: async (a) => {
				const n = parseInt(await self.parseVariablesInString(String(a.options.n ?? '1')), 10)
				return self.command(`/api/prompter/mark?n=${isNaN(n) ? 1 : n}`)
			},
		},
	})
}
