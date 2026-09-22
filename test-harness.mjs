/**
 * Drives the module's real code against a running copy of StreamGraphics Pro,
 * standing in for Companion. Not shipped — this is how I verify a build.
 *
 *   node test-harness.mjs [host] [port]
 */
import { SgpApi } from './src/api.js'
import { updateActions } from './src/actions.js'
import { updateFeedbacks } from './src/feedbacks.js'
import { updatePresets } from './src/presets.js'
import { updateVariableDefinitions, updateVariableValues } from './src/variables.js'

const host = process.argv[2] || '127.0.0.1'
const port = Number(process.argv[3] || 4000)

let fails = 0
const ok = (label, cond, extra = '') => {
	if (!cond) fails++
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
}

const self = {
	config: { host, port },
	/* Companion hands the module the CONNECTION's label and keeps it current. The presets embed
	   it in their variable references, so a stub without one would quietly build `$(undefined:…)`
	   and every check below would still pass. Deliberately NOT the module id or anything a
	   default would produce — if a prefix is ever baked in again, this value will not match it. */
	label: 'sgp-harness-label',
	state: {},
	choices: { presets: [], scoreboards: [] },
	connected: false,
	appVersion: '',
	clockOffset: 0,
	namesKey: '',
	actions: {},
	feedbacks: {},
	presets: {},
	varDefs: [],
	vars: {},
	setActionDefinitions(d) { this.actions = d },
	setFeedbackDefinitions(d) { this.feedbacks = d },
	setPresetDefinitions(d) { this.presets = d },
	setVariableDefinitions(d) { this.varDefs = d },
	setVariableValues(v) { Object.assign(this.vars, v) },
	checkFeedbacks() {},
	log(lvl, m) { console.log(`   [${lvl}] ${m}`) },
	async parseVariablesInString(s) { return s },
	async command(path) {
		try { await this.api.send(path); return true } catch (e) { console.log(`   command FAILED ${path}: ${e.message}`); return false }
	},
	onDisconnected(why) { this.connected = false; console.log(`   disconnected: ${why}`) },
	pushes: 0,
	onState(state, version) {
		this.connected = true
		this.pushes++
		this.state = state
		this.appVersion = version || ''
		this.choices = {
			presets: (state.shows ?? []).map((s) => ({ id: s.name, label: s.name })),
			scoreboards: (state.scoreboards ?? []).map((b) => ({ id: b.name, label: b.name })),
			marks: (state.prompter?.geom?.marks ?? []).map((m) => ({ id: m.name, label: m.name })),
			scripts: (state.scripts ?? []).map((s) => ({ id: s.name, label: s.name })),
		}
		/* Rebuild when the NAMES change, exactly as main.js does. Bookmarks arrive late — they
		   do not exist until a prompter screen has measured the script — so a harness that built
		   its definitions once at connect would test a module that had never seen a bookmark. */
		const key = JSON.stringify([
			this.choices.presets.map((c) => c.id),
			this.choices.scoreboards.map((c) => c.id),
			this.choices.marks.map((c) => c.id),
			this.choices.scripts.map((c) => c.id),
		])
		if (key !== this.namesKey) {
			this.namesKey = key
			updateActions(this); updateFeedbacks(this); updatePresets(this); updateVariableDefinitions(this)
		}
		updateVariableValues(this)
		if (this.waiter) { const w = this.waiter; this.waiter = null; w() }
	},
}
self.api = new SgpApi(self)

const nextState = () => new Promise((r) => { self.waiter = r; setTimeout(r, 4000) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log(`\n--- StreamGraphics Pro module harness -> ${host}:${port} ---\n`)
self.api.connect()
await nextState()

ok('SSE connected and state received', self.connected)
ok('app version reported', !!self.appVersion, self.appVersion)
ok('actions built', Object.keys(self.actions).length >= 25, `${Object.keys(self.actions).length} actions`)
ok('feedbacks built', Object.keys(self.feedbacks).length >= 6, `${Object.keys(self.feedbacks).length} feedbacks`)
ok('presets built', Object.keys(self.presets).length >= 10, `${Object.keys(self.presets).length} buttons`)
ok('variables defined', self.varDefs.length >= 15, `${self.varDefs.length} variables`)
ok('scoreboard choices found', self.choices.scoreboards.length > 0, JSON.stringify(self.choices.scoreboards.map((c) => c.id)))
ok('preset choices found', self.choices.presets.length > 0, `${self.choices.presets.length} presets`)

const board = self.state.scoreboards[0]
const bk = board.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// --- scoring round trip -------------------------------------------------
const before = Number(self.vars[`sb_${bk}_score1`] ?? 0)
await self.actions.sb_point.callback({ options: { name: board.name, team: '1', delta: '1' } })
await nextState()
ok('scoring a point moves the score variable', Number(self.vars[`sb_${bk}_score1`]) === before + 1,
	`${before} -> ${self.vars[`sb_${bk}_score1`]}`)

await self.actions.sb_point.callback({ options: { name: board.name, team: '1', delta: '-1' } })
await nextState()
ok('taking a point back works', Number(self.vars[`sb_${bk}_score1`]) === before)

// --- on air / off air + feedback ----------------------------------------
await self.actions.sb_show.callback({ options: { name: board.name } })
await nextState()
ok('scoreboard on air', self.vars[`sb_${bk}_onair`] === 'ON AIR')
ok('scoreboard feedback true when on air', self.feedbacks.scoreboard_visible.callback({ options: { name: board.name } }) === true)
await self.actions.sb_hide.callback({ options: { name: board.name } })
await nextState()
ok('scoreboard off air', self.vars[`sb_${bk}_onair`] === 'off')
ok('scoreboard feedback false when off air', self.feedbacks.scoreboard_visible.callback({ options: { name: board.name } }) === false)
ok('blank scoreboard name falls back to the first board',
	self.feedbacks.scoreboard_visible.callback({ options: { name: '' } }) === false)

// --- library preset ------------------------------------------------------
const show = self.state.shows[0]
const sk = show.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
await self.actions.preset_on.callback({ options: { name: show.name } })
await nextState()
ok('preset on air', self.vars[`preset_${sk}_onair`] === 'ON AIR', show.name)
ok('preset feedback true', self.feedbacks.preset_on.callback({ options: { name: show.name } }) === true)
ok('preset feedback is case-insensitive', self.feedbacks.preset_on.callback({ options: { name: show.name.toUpperCase() } }) === true)
ok('presets_on counter moved', Number(self.vars.presets_on) >= 1)
await self.actions.preset_alloff.callback({ options: {} })
await nextState()
ok('all off clears everything', Number(self.vars.presets_on) === 0)

// --- what happens BETWEEN rows (cross fade, dip to colour, slide) ---------
// 🚨 Driven through the module's own action, not by calling the API directly — the point is that
//    the button a user builds reaches the app, so the option id and the URL have to line up too.
const modeOf = () => self.state.shows.find((s) => s.name === show.name)?.rowTransition
ok('the change-style action exists', !!self.actions.preset_change)
for (const m of ['fadeblack', 'pushright', 'crossfade']) {
	await self.actions.preset_change.callback({ options: { name: show.name, mode: m } })
	await nextState()
	ok(`change style reaches the app: ${m}`, modeOf() === m, String(modeOf()))
}
// ⛔ control: a style the app does not know must be REFUSED and leave the deck alone, or the
//    checks above would pass on a module that sends anything at all.
const modeBefore = modeOf()
const badMode = await self.actions.preset_change.callback({ options: { name: show.name, mode: 'sparkle' } })
await nextState()
ok('⛔ an unknown style is refused and changes nothing', badMode === false && modeOf() === modeBefore, `${badMode} / ${modeOf()}`)
ok(
	'⛔ every style in the dropdown is one the app accepts',
	self.actions.preset_change.options
		.find((o) => o.id === 'mode')
		.choices.every((c) => ['crossfade', 'fadeblack', 'fadewhite', 'pushleft', 'pushright', 'cut', 'reanimate'].includes(c.id))
)

// --- timer ---------------------------------------------------------------
await self.actions.timer_set.callback({ options: { mmss: '02:30' } })
await nextState()
ok('timer set to 02:30', self.vars.timer_time === '02:30', String(self.vars.timer_time))
await self.actions.timer_start.callback({ options: {} })
await nextState()
ok('timer reports running', self.vars.timer_state === 'running')
ok('timer_running feedback true', self.feedbacks.timer_running.callback({}) === true)
await sleep(1300)
updateVariableValues(self)
ok('clock actually ticks down between pushes', self.vars.timer_time !== '02:30', String(self.vars.timer_time))
await self.actions.timer_adjust.callback({ options: { seconds: '30' } })
await nextState()
await self.actions.timer_pause.callback({ options: {} })
await nextState()
ok('timer pauses', self.vars.timer_state === 'paused')
await self.actions.timer_reset.callback({ options: {} })
await nextState()

// --- baseball ------------------------------------------------------------
await self.actions.bl_ball.callback({ options: {} })
await self.actions.bl_strike.callback({ options: {} })
await nextState()
ok('baseball count variable reads right', self.vars.bl_count === '1-1', String(self.vars.bl_count))
await self.actions.bl_clearcount.callback({ options: {} })
await nextState()
ok('clear count works', self.vars.bl_count === '0-0')
const r0 = Number(self.vars.bl_score1)
await self.actions.bl_run.callback({ options: { team: '1', delta: '2' } })
await nextState()
ok('baseball runs add up from the line score', Number(self.vars.bl_score1) === r0 + 2, `${r0} -> ${self.vars.bl_score1}`)
await self.actions.bl_run.callback({ options: { team: '1', delta: '-2' } })
await nextState()

// --- bad input should be handled, not thrown ----------------------------
const badOk = await self.command('/api/preset/on?name=' + encodeURIComponent('does not exist at all'))
ok('unknown name fails cleanly instead of throwing', badOk === false)
ok('connected feedback true', self.feedbacks.connected.callback({}) === true)

// --- preset buttons reference variables that really exist ---------------
const known = new Set(self.varDefs.map((d) => d.variableId))
let bad = []
let wrongPrefix = []
let refs = 0
for (const [id, p] of Object.entries(self.presets)) {
	// Capture the PREFIX rather than assuming it. The old version of this check matched a fixed
	// `streamgraphics-pro:`; once the prefix changed it matched nothing at all and passed while
	// testing nothing — which is why `refs` is asserted below.
	for (const m of String(p.style?.text ?? '').matchAll(/\$\(([^:)]+):([a-z0-9_]+)\)/g)) {
		refs++
		if (m[1] !== self.label) wrongPrefix.push(`${id} -> $(${m[1]}:…)`)
		if (!known.has(m[2])) bad.push(`${id} -> ${m[2]}`)
	}
}
ok('preset buttons actually reference variables', refs > 0, `${refs} references`)
ok(
	'every variable reference is namespaced by the connection label',
	wrongPrefix.length === 0,
	wrongPrefix.slice(0, 5).join(', '),
)
ok('every variable used on a preset button is defined', bad.length === 0, bad.join(', '))

// Button text needs REAL newlines. A literal backslash-n prints as "\n" on the key.
const escaped = Object.entries(self.presets)
	.filter(([, p]) => /\\n/.test(String(p.style?.text ?? '')) || /\\n/.test(String(p.feedbacks?.[0]?.style?.text ?? '')))
	.map(([id]) => id)
ok('preset button text uses real newlines, not a literal backslash-n', escaped.length === 0, escaped.join(', '))

// Companion only accepts a fixed set of text sizes.
const SIZES = new Set(['auto', '7', '14', '18', '24', '30', '44'])
const badSize = Object.entries(self.presets)
	.filter(([, p]) => !SIZES.has(String(p.style?.size)) && typeof p.style?.size !== 'number')
	.map(([id, p]) => `${id}=${p?.style?.size}`)
ok('every preset uses a text size Companion accepts', badSize.length === 0, badSize.join(', '))

// Shapes Companion's own types require.
const shapeBad = Object.entries(self.presets)
	.filter(([, p]) => p.type !== 'button' || !p.category || !p.name || !Array.isArray(p.steps) || !Array.isArray(p.feedbacks))
	.map(([id]) => id)
ok('every preset matches the button preset shape', shapeBad.length === 0, shapeBad.join(', '))

// Every action and feedback a preset points at must actually exist.
const missing = []
for (const [id, p] of Object.entries(self.presets)) {
	for (const st of p.steps ?? []) for (const a of [...(st.down ?? []), ...(st.up ?? [])]) if (!self.actions[a.actionId]) missing.push(`${id} -> action ${a.actionId}`)
	for (const f of p.feedbacks ?? []) if (!self.feedbacks[f.feedbackId]) missing.push(`${id} -> feedback ${f.feedbackId}`)
}
ok('every action/feedback referenced by a preset exists', missing.length === 0, missing.join(', '))

// --- bullet build round trip (needs a Library preset containing a bullets layer) ---------
const bulPreset = (self.state.shows ?? []).find((s) => (s.reveals ?? []).length)
if (!bulPreset) {
	console.log('   SKIPPED bullets round trip — no preset in the Library has a bullets layer')
} else {
	const pk = bulPreset.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
	ok('bullet transport actions exist', !!self.actions.bullets_next && !!self.actions.bullets_blank)
	ok('bullet buttons were built for the graphic', !!self.presets[`bul_next_${pk}`])

	await self.actions.bullets_blank.callback({ options: { name: bulPreset.name, layer: '' } })
	await nextState()
	ok('blank leaves nothing revealed', Number(self.vars[`preset_${pk}_bullet`]) === 0, String(self.vars[`preset_${pk}_bullet`]))

	await self.actions.bullets_next.callback({ options: { name: bulPreset.name, layer: '' } })
	await nextState()
	ok('next reveals the first point', Number(self.vars[`preset_${pk}_bullet`]) === 1, String(self.vars[`preset_${pk}_bullet`]))

	await self.actions.bullets_next.callback({ options: { name: bulPreset.name, layer: '' } })
	await nextState()
	ok('next again reveals the second', Number(self.vars[`preset_${pk}_bullet`]) === 2, String(self.vars[`preset_${pk}_bullet`]))

	await self.actions.bullets_prev.callback({ options: { name: bulPreset.name, layer: '' } })
	await nextState()
	ok('prev takes the last point back', Number(self.vars[`preset_${pk}_bullet`]) === 1, String(self.vars[`preset_${pk}_bullet`]))

	await self.actions.bullets_all.callback({ options: { name: bulPreset.name, layer: '' } })
	await nextState()
	const total = Number(self.vars[`preset_${pk}_bullets`])
	ok('all reveals every point', Number(self.vars[`preset_${pk}_bullet`]) === total, `${self.vars[`preset_${pk}_bullet`]}/${total}`)

	await self.actions.bullets_goto.callback({ options: { name: bulPreset.name, layer: '', n: '2' } })
	await nextState()
	ok('jump to a point lands on it', Number(self.vars[`preset_${pk}_bullet`]) === 2, String(self.vars[`preset_${pk}_bullet`]))

	await self.actions.bullets_blank.callback({ options: { name: bulPreset.name, layer: '' } })
	await nextState()
}

// --- teleprompter ---------------------------------------------------------------------
// Needs a prompter OUTPUT screen open somewhere, because that is what measures the script and
// tells the app where the bookmarks are. Without one there is no length and no bookmarks, and
// the module is right to show nothing — so that case is asserted rather than skipped.
{
	ok('prompter actions exist', !!self.actions.prompter_play && !!self.actions.prompter_mark,
		`${Object.keys(self.actions).filter((k) => k.startsWith('prompter_')).length} prompter actions`)
	ok('prompter feedbacks exist', !!self.feedbacks.prompter_visible && !!self.feedbacks.prompter_at_mark)

	await self.actions.prompter_air.callback({ options: {} })
	await nextState()
	ok('prompter on air', self.vars.prompter_onair === 'ON AIR', String(self.vars.prompter_onair))
	ok('on-air feedback true', self.feedbacks.prompter_visible.callback({}) === true)

	await self.actions.prompter_pause.callback({ options: {} })
	await self.actions.prompter_top.callback({ options: {} })
	await nextState()
	ok('holding reads as holding', self.vars.prompter_state === 'holding', String(self.vars.prompter_state))
	ok('rolling feedback false while held', self.feedbacks.prompter_running.callback({}) === false)

	// speed
	await self.actions.prompter_speed.callback({ options: { value: '60' } })
	await nextState()
	ok('speed can be set outright', Number(self.vars.prompter_speed) === 60, String(self.vars.prompter_speed))
	await self.actions.prompter_faster.callback({ options: { by: '10' } })
	await nextState()
	ok('speed up adds to it', Number(self.vars.prompter_speed) === 70, String(self.vars.prompter_speed))
	await self.actions.prompter_slower.callback({ options: { by: '10' } })
	await nextState()
	ok('slow down takes it off again', Number(self.vars.prompter_speed) === 60, String(self.vars.prompter_speed))

	const marks = self.state.prompter?.geom?.marks ?? []
	if (!marks.length) {
		ok('with no script measured, no section is claimed', self.vars.prompter_section === '' && self.vars.prompter_sections === 0,
			`section=${JSON.stringify(self.vars.prompter_section)} of ${self.vars.prompter_sections}`)
		ok('and no percentage is invented', self.vars.prompter_percent === '', String(self.vars.prompter_percent))
		console.log('   SKIPPED bookmark round trip — open /prompter-output with a script loaded to cover it')
	} else {
		ok('bookmarks became dropdown choices', self.choices.marks.length === marks.length,
			self.choices.marks.map((c) => c.id).join(' | '))
		ok('a button was built for each bookmark',
			marks.every((m) => !!self.presets[`prompter_mark_${m.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`]))
		ok('sections counted', Number(self.vars.prompter_sections) === marks.length, String(self.vars.prompter_sections))

		// Jump by NAME to each one in turn, and check the section readout follows.
		for (const m of marks) {
			await self.actions.prompter_mark.callback({ options: { name: m.name } })
			await nextState()
			updateVariableValues(self)
			ok(`jump to "${m.name}" lands there`, self.vars.prompter_section === m.name, String(self.vars.prompter_section))
			ok(`…and only that section's button lights up`,
				marks.every((x) => self.feedbacks.prompter_at_mark.callback({ options: { name: x.name } }) === (x.name === m.name)))
		}

		// A name that no longer exists must fail loudly rather than jumping somewhere arbitrary.
		const bad = await self.command('/api/prompter/mark?name=' + encodeURIComponent('a section that was cut'))
		ok('a bookmark that no longer exists fails cleanly instead of jumping somewhere else', bad === false)

		// next / prev walk the sections
		await self.actions.prompter_top.callback({ options: {} })
		await nextState()
		await self.actions.prompter_nextmark.callback({ options: {} })
		await nextState()
		updateVariableValues(self)
		ok('next bookmark steps forward', Number(self.vars.prompter_section_n) >= 1, String(self.vars.prompter_section_n))

		/* 🚨 The one that needed the extra ticker in main.js: with the script ROLLING, the app
		   sends nothing at all as the read crosses from one section into the next. If the module
		   only recalculated on a state push, the section readout would stick on the section the
		   operator last jumped to for the whole show. */
		await self.actions.prompter_mark.callback({ options: { name: marks[0].name } })
		await nextState()
		await self.actions.prompter_speed.callback({ options: { value: '4000' } })
		await self.actions.prompter_play.callback({ options: {} })
		await nextState()
		ok('rolling reads as rolling', self.vars.prompter_state === 'rolling', String(self.vars.prompter_state))
		ok('rolling feedback true', self.feedbacks.prompter_running.callback({}) === true)
		const wasSection = self.vars.prompter_section
		const wasPct = self.vars.prompter_percent
		const pushes = self.pushes
		await sleep(1500)
		updateVariableValues(self)     // no state push in between — this is the whole point
		ok('the position moves between state pushes', self.vars.prompter_percent !== wasPct,
			`${wasPct}% -> ${self.vars.prompter_percent}%  (${self.pushes - pushes} pushes in that time)`)
		if (marks.length > 1) {
			ok('and the section follows the read across a bookmark without the app saying anything',
				self.vars.prompter_section !== wasSection, `${wasSection} -> ${self.vars.prompter_section}`)
		}
		ok('time left is reported while rolling', /^\d+:\d\d/.test(String(self.vars.prompter_left)), String(self.vars.prompter_left))

		await self.actions.prompter_pause.callback({ options: {} })
		await self.actions.prompter_speed.callback({ options: { value: '60' } })
		await self.actions.prompter_top.callback({ options: {} })
		await nextState()
	}

	// Off air must not stop the scroll, and holding must not take it off air — they are separate.
	await self.actions.prompter_off.callback({ options: {} })
	await nextState()
	ok('prompter off air', self.vars.prompter_onair === 'off', String(self.vars.prompter_onair))
	ok('off-air feedback false', self.feedbacks.prompter_visible.callback({}) === false)
}

/* ---------------------------------------------------------------- the SCRIPT LIBRARY
   🚨 The point of this section is that the library is LIVE. An operator saves a script in the
   app during rehearsal and the button must appear in Companion without restarting anything —
   which only works if a new script name forces a definitions rebuild. */
{
	const before = Object.keys(self.presets).filter((k) => k.startsWith('prompter_script_')).length

	// Save two scripts through the app's own action endpoint, as the operator would in the UI.
	const post = async (obj) => {
		const r = await fetch(`http://${host}:${port}/action`, {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj),
		})
		return r.ok
	}
	await post({ type: 'pr_script', text: '## Segment one\nFirst script body.\n' })
	await post({ type: 'pr_lib_save', name: 'Harness Alpha' })
	await post({ type: 'pr_script', text: '## Segment two\nSecond script body.\n' })
	await post({ type: 'pr_lib_save', name: 'Harness Beta' })
	await nextState(); await sleep(400); await nextState()

	ok('saved scripts reach the module', (self.state.scripts ?? []).length >= 2,
		JSON.stringify((self.state.scripts ?? []).map((s) => s.name)))
	ok('the module never receives the script TEXT, only the list',
		!(self.state.scripts ?? []).some((s) => 'text' in s),
		JSON.stringify(Object.keys((self.state.scripts ?? [])[0] ?? {})))

	const after = Object.keys(self.presets).filter((k) => k.startsWith('prompter_script_')).length
	ok('a script saved in the app creates a ready-made button with no restart', after > before,
		`${before} -> ${after}`)

	ok('the load action exists', typeof self.actions.prompter_script?.callback === 'function')
	ok('its dropdown is filled from the library',
		(self.actions.prompter_script.options[0].choices ?? []).some((c) => c.id === 'Harness Alpha'))

	ok('the variable names the loaded script', self.vars.prompter_script === 'Harness Beta',
		String(self.vars.prompter_script))
	ok('and says it matches what was saved', self.vars.prompter_script_state === 'saved',
		String(self.vars.prompter_script_state))
	ok('the feedback lights the loaded one',
		self.feedbacks.prompter_script_loaded.callback({ options: { name: 'Harness Beta' } }) === true)
	ok('and not the other one',
		self.feedbacks.prompter_script_loaded.callback({ options: { name: 'Harness Alpha' } }) === false)

	// 🚨 Load BY NAME — the whole feature. A Stream Deck knows names, never ids.
	await self.actions.prompter_script.callback({ options: { name: 'Harness Alpha' } })
	await nextState(); await sleep(300); await nextState()
	ok('loading by name puts that script on air', /First script body/.test(String(self.state.prompter?.script)),
		String(self.state.prompter?.script).slice(0, 40))
	ok('and the variable follows', self.vars.prompter_script === 'Harness Alpha', String(self.vars.prompter_script))
	ok('and the feedback moves with it',
		self.feedbacks.prompter_script_loaded.callback({ options: { name: 'Harness Alpha' } }) === true)

	// Editing on air must show as edited, so nobody goes to air on a stale copy unknowingly.
	await post({ type: 'pr_script', text: '## Segment one\nFirst script body, changed.\n' })
	await nextState(); await sleep(300); await nextState()
	ok('an on-air edit shows as edited', self.vars.prompter_script_state === 'edited',
		String(self.vars.prompter_script_state))

	// 🚨 A name that does not exist must FAIL LOUDLY, not quietly do nothing.
	const okBad = await self.command('/api/prompter/script?name=No%20Such%20Script')
	ok('a button pointing at a deleted script reports failure rather than silently doing nothing',
		okBad === false, String(okBad))

	// tidy up so repeated runs do not pile up
	for (const s of self.state.scripts ?? []) {
		if (/^Harness /.test(s.name)) await post({ type: 'pr_lib_delete', id: s.id })
	}
	await nextState()
}

self.api.close()
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}\n`)
process.exit(fails === 0 ? 0 : 1)
