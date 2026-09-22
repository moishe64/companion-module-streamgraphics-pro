/**
 * Variables track live app state so button text can show real numbers —
 * the score, which spreadsheet row is up, the clock — instead of a fixed label.
 *
 * Variable ids are derived from the names you used in the app, lower-cased with
 * anything awkward turned into an underscore. "Court 1" becomes sb_court_1_score1.
 */

export const slug = (s) =>
	String(s ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '') || 'unnamed'

/**
 * 🚨 Two names that differ ONLY in punctuation produce the SAME variable id — "Court 1",
 * "Court-1" and "Court #1" all become court_1. Whichever is written last wins, so a button
 * reading $(sgpro:sb_court_1_score1) quietly shows the other scoreboard's score.
 *
 * ⛔ Renaming the ids to make them unique would be worse than the problem: the id is what a
 * button refers to, so it would change under buttons the user has already built, and it would
 * change again the moment anything is reordered or renamed.
 *
 * So: leave the ids alone and SAY SO. A warning in the connection log names both offenders and
 * the id they are fighting over, which turns a silently wrong number into something fixable
 * (rename one of them in the app).
 */
export function warnOnSlugCollisions(self, groups) {
	const clashes = []
	for (const [what, names] of Object.entries(groups)) {
		const seen = new Map()
		for (const n of names) {
			const k = slug(n)
			if (seen.has(k) && seen.get(k) !== n) clashes.push(`${what} "${seen.get(k)}" and "${n}" both become "${k}"`)
			else seen.set(k, n)
		}
	}
	// Only speak when it changes, or every state update would repeat the same warning.
	const sig = clashes.join(' | ')
	if (sig === self._slugWarnSig) return
	self._slugWarnSig = sig
	if (clashes.length) {
		self.log(
			'warn',
			'Names that differ only in punctuation share one variable id, so one overwrites the other: ' +
				clashes.join('; ') +
				'. Rename one of each pair in StreamGraphics Pro to tell them apart.'
		)
	}
}

const pad = (n) => String(n).padStart(2, '0')

/** Baseball totals are the sum of the per-inning line score. */
const runs = (team) => (team?.line ?? []).reduce((a, n) => a + (Number(n) || 0), 0)

/** ms -> "-MM:SS" or "H:MM:SS", matching how the app itself reads on screen. */
export function fmtTime(ms, showHours) {
	const neg = ms < 0
	let t = Math.floor(Math.abs(ms) / 1000)
	const h = Math.floor(t / 3600)
	t -= h * 3600
	const m = Math.floor(t / 60)
	const s = t - m * 60
	const body = showHours || h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
	return (neg ? '-' : '') + body
}

/** What the presenter timer reads right now, worked out against the show computer's clock. */
export function timerMs(timer, clockOffset) {
	if (!timer) return 0
	const now = Date.now() + (clockOffset || 0)
	const since = timer.running ? now - (timer.anchorServer || 0) : 0
	if (timer.mode === 'up') return (timer.baseMs || 0) + since
	if (timer.mode === 'tod') return (timer.targetEpoch || 0) - now
	return (timer.baseMs || 0) - since
}

/**
 * Where the teleprompter has actually got to, right now.
 *
 * 🚨 The app does NOT push a position as it scrolls, and it is right not to: it pushes an
 * anchor and a speed, and every screen works out its own frame from those. So does this. A
 * module that waited for a position update would show a frozen number all the way through a
 * five-minute read — which looks exactly like a crash to the person watching the button.
 *
 * This is the same arithmetic as livePromptPx() in the app, deliberately duplicated rather
 * than shared, because the two are separate programs on separate computers.
 */
export function prompterPx(p, clockOffset) {
	if (!p) return 0
	const now = Date.now() + (clockOffset || 0)
	const px = (p.basePx || 0) + (p.running && p.speed > 0 ? ((now - (p.anchorServer || 0)) * p.speed) / 1000 : 0)
	const max = prompterMaxPx(p)
	if (!(px > 0)) return 0
	return max >= 0 && px > max ? max : px
}

/** How long the script is, in the same units. -1 while no screen has measured it yet. */
export function prompterMaxPx(p) {
	return p?.geom?.sig ? Math.max(0, p.geom.total || 0) : -1
}

/** The bookmark the read is inside — the last one it has passed, not the next one coming. */
export function prompterSection(p, clockOffset) {
	const marks = p?.geom?.marks ?? []
	if (!marks.length) return { index: -1, name: '', count: 0 }
	const px = prompterPx(p, clockOffset)
	let i = -1
	// A small tolerance: landing exactly on a bookmark should read as being IN it, and the
	// position is a float that will not land on an integer y.
	for (let k = 0; k < marks.length; k++) if (px + 1 >= (marks[k].y || 0)) i = k
	return { index: i, name: i >= 0 ? marks[i].name : '', count: marks.length }
}

export function updateVariableDefinitions(self) {
	warnOnSlugCollisions(self, {
		Scoreboards: (self.state.scoreboards ?? []).map((b) => b.name),
		'Library presets': (self.state.shows ?? []).map((s) => s.name),
	})
	const defs = [
		{ variableId: 'connection', name: 'Connection to StreamGraphics Pro' },
		{ variableId: 'app_version', name: 'App version on the show computer' },
		{ variableId: 'timer_time', name: 'Presenter timer — time on the clock' },
		{ variableId: 'timer_mode', name: 'Presenter timer — mode' },
		{ variableId: 'timer_state', name: 'Presenter timer — running / paused' },
		{ variableId: 'presets_on', name: 'How many library presets are on air' },
		{ variableId: 'bl_score1', name: 'Baseball — away runs' },
		{ variableId: 'bl_score2', name: 'Baseball — home runs' },
		{ variableId: 'bl_inning', name: 'Baseball — inning (e.g. Top 3)' },
		{ variableId: 'bl_count', name: 'Baseball — count (e.g. 2-1)' },
		{ variableId: 'bl_outs', name: 'Baseball — outs' },
		{ variableId: 'prompter_onair', name: 'Teleprompter — on air?' },
		{ variableId: 'prompter_state', name: 'Teleprompter — rolling / holding' },
		{ variableId: 'prompter_speed', name: 'Teleprompter — speed (pixels a second)' },
		{ variableId: 'prompter_percent', name: 'Teleprompter — how far through the script, as a percentage' },
		{ variableId: 'prompter_section', name: 'Teleprompter — the section being read' },
		{ variableId: 'prompter_section_n', name: 'Teleprompter — section number' },
		{ variableId: 'prompter_sections', name: 'Teleprompter — sections in the script' },
		{ variableId: 'prompter_left', name: 'Teleprompter — time left at the current speed' },
		{ variableId: 'prompter_script', name: 'Teleprompter — the saved script that is loaded' },
		{ variableId: 'prompter_script_state', name: 'Teleprompter — whether the loaded script has unsaved edits' },
	]

	for (const b of self.state.scoreboards ?? []) {
		const k = slug(b.name)
		defs.push(
			{ variableId: `sb_${k}_score1`, name: `${b.name} — team 1 score (current game)` },
			{ variableId: `sb_${k}_score2`, name: `${b.name} — team 2 score (current game)` },
			{ variableId: `sb_${k}_team1`, name: `${b.name} — team 1 name` },
			{ variableId: `sb_${k}_team2`, name: `${b.name} — team 2 name` },
			{ variableId: `sb_${k}_game`, name: `${b.name} — current game number` },
			{ variableId: `sb_${k}_onair`, name: `${b.name} — on air?` }
		)
	}

	for (const s of self.state.shows ?? []) {
		const k = slug(s.name)
		defs.push(
			{ variableId: `preset_${k}_onair`, name: `${s.name} — on air?` },
			{ variableId: `preset_${k}_row`, name: `${s.name} — spreadsheet row showing` },
			{ variableId: `preset_${k}_rows`, name: `${s.name} — spreadsheet rows in total` },
			{ variableId: `preset_${k}_label`, name: `${s.name} — label of the row showing` }
		)
		if ((s.reveals ?? []).length) {
			defs.push(
				{ variableId: `preset_${k}_bullet`, name: `${s.name} — bullet showing (0 = none yet)` },
				{ variableId: `preset_${k}_bullets`, name: `${s.name} — bullets in total` }
			)
		}
	}

	self.setVariableDefinitions(defs)
}

export function updateVariableValues(self) {
	const st = self.state
	const v = {
		connection: self.connected ? 'connected' : 'disconnected',
		app_version: self.appVersion || '',
		timer_time: fmtTime(timerMs(st.timer, self.clockOffset), st.timer?.showHours),
		timer_mode: st.timer?.mode === 'up' ? 'count up' : st.timer?.mode === 'tod' ? 'time of day' : 'countdown',
		timer_state: st.timer?.running ? 'running' : 'paused',
		presets_on: (st.shows ?? []).filter((s) => s.on).length,
		// Runs are the sum of the line score — there is no separate total in the app state.
		bl_score1: runs(st.baseball?.teams?.[0]),
		bl_score2: runs(st.baseball?.teams?.[1]),
		bl_inning: st.baseball ? `${st.baseball.half === 'bottom' ? 'Bot' : 'Top'} ${st.baseball.inning ?? ''}`.trim() : '',
		bl_count: st.baseball ? `${st.baseball.balls ?? 0}-${st.baseball.strikes ?? 0}` : '',
		bl_outs: st.baseball?.outs ?? 0,
	}

	// ---- teleprompter ----
	const p = st.prompter
	const max = prompterMaxPx(p)
	const px = prompterPx(p, self.clockOffset)
	const sec = prompterSection(p, self.clockOffset)
	v.prompter_onair = p?.visible ? 'ON AIR' : 'off'
	v.prompter_state = p?.running ? 'rolling' : 'holding'
	v.prompter_speed = Math.round(p?.speed ?? 0)
	// Until a prompter screen is open nothing has measured the script, so there is no length
	// and therefore no percentage. Showing 0% would be a lie; showing nothing is honest.
	v.prompter_percent = max > 0 ? Math.min(100, Math.round((px / max) * 100)) : ''
	v.prompter_section = sec.name
	v.prompter_section_n = sec.index >= 0 ? sec.index + 1 : 0
	v.prompter_sections = sec.count
	v.prompter_left = max > 0 && (p?.speed ?? 0) > 0 ? fmtTime(((max - px) / p.speed) * 1000) : ''
	/* Blank, not "none", when the script on air was never saved — an operator glancing at a
	   button wants the name of the script or nothing, and a word like "none" reads as a state. */
	v.prompter_script = p?.libName ?? ''
	v.prompter_script_state = p?.libName ? (p.libDirty ? 'edited' : 'saved') : ''

	for (const b of st.scoreboards ?? []) {
		const k = slug(b.name)
		const g = b.activeGame | 0
		const nm = (t) => [t?.p1, t?.p2].filter(Boolean).join(' / ')
		v[`sb_${k}_score1`] = b.teams?.[0]?.games?.[g] ?? 0
		v[`sb_${k}_score2`] = b.teams?.[1]?.games?.[g] ?? 0
		v[`sb_${k}_team1`] = nm(b.teams?.[0])
		v[`sb_${k}_team2`] = nm(b.teams?.[1])
		v[`sb_${k}_game`] = g + 1
		v[`sb_${k}_onair`] = b.visible ? 'ON AIR' : 'off'
	}

	for (const s of st.shows ?? []) {
		const k = slug(s.name)
		const total = s.rowCount ?? s.rows?.length ?? 0
		const idx = s.rowIndex ?? 0
		v[`preset_${k}_onair`] = s.on ? 'ON AIR' : 'off'
		v[`preset_${k}_row`] = total ? idx + 1 : 0
		v[`preset_${k}_rows`] = total
		v[`preset_${k}_label`] = s.rowLabels?.[idx] ?? ''
		// First bullets/slides layer in the graphic — the one a plain Next button drives.
		const rv = (s.reveals ?? [])[0]
		if (rv) {
			v[`preset_${k}_bullet`] = (rv.index ?? -1) + 1
			v[`preset_${k}_bullets`] = rv.count ?? 0
		}
	}

	self.setVariableValues(v)
}
