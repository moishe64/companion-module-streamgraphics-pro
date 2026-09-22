## StreamGraphics Pro

Drive StreamGraphics Pro from Companion — graphics on and off air, scoreboards,
the presenter timer, baseball/softball, and the teleprompter.

### Setting it up

1. Start StreamGraphics Pro on the show computer. It needs to be running before
   this connection can go green.
2. Add this connection in Companion and fill in two fields:

   | Field | What to put |
   |---|---|
   | Address of the show computer | `127.0.0.1` if Companion is on that same computer. Otherwise the show computer's own network address, which the app prints on its home page under "Use on another device" — read it from there rather than guessing |
   | Port | `4000` unless you changed it |

3. The connection turns green when it's talking to the app. If it doesn't, check
   the app is actually running, and that Windows didn't block network access the
   first time it asked.

### Getting buttons fast

Don't build buttons by hand. Open the **Presets** tab and drag them across — the
module reads your app and generates buttons that are already wired up:

- one **Scoreboard — <name>** category per scoreboard, so a five-court meet gives
  you five ready-made scoring pages
- a **Library presets** category with a toggle for every saved graphic, plus
  next/previous row buttons for any preset with a spreadsheet attached
- **Presenter timer** and **Baseball / softball** categories
- a **Teleprompter** category, plus **Teleprompter — sections** holding one jump
  button per heading in the script that's loaded

If you rename something in the app, or add a court, the actions, buttons and
variables follow automatically — no reconnect needed.

### Everything is addressed by name

Actions refer to graphics and scoreboards by the **name you gave them in the
app**, not by a hidden id. A button built today keeps working after you rebuild
the show file, as long as the name still matches.

Every dropdown also accepts a typed value, so you can drive it from a variable —
handy for "current court" style setups.

### Button colours that mean something

Add a feedback so a button shows what's actually happening rather than what you
last pressed:

- **Library preset is on air** — red while it's on the Program output
- **Scoreboard is on air** — red while that board is showing
- **Presenter timer is on air / is running**
- **Baseball board is on air**
- **Teleprompter is on air / is rolling** — red when the script is being shown,
  green while it's actually moving
- **Teleprompter is in this section** — lights whichever section button the read
  has reached, so you can see where the presenter is without looking away
- **Connected to StreamGraphics Pro** — put this on a spare button. It goes green
  when the link is healthy. Worth a glance before you go live.

### The teleprompter

Two things that are easy to confuse, so the actions spell them out:

- **on air / off air** — whether the script is being shown at all
- **roll / hold** — whether it's moving

Holding the script doesn't take it off the presenter's screen, and taking it off
air doesn't stop the scroll. They're separate on purpose.

Jump buttons are addressed by the **heading name**, not by number. A script gets
rewritten an hour before the show and every section shifts; a button aimed at
"Half time" still lands on half time, where a button aimed at "section 4" would
quietly send the read to the wrong place.

Bookmarks only appear once a prompter screen has been opened at least once —
that's what measures the script. Until then the section and percentage variables
are deliberately blank rather than showing a made-up zero.

The **Where the read is** preset is a button with no action on it: section,
percentage, and how long is left at the current speed.

### Variables

Put live numbers on a button instead of a fixed label. Write a variable as
`$(connection:name)`, where `connection` is the name you gave this connection on
Companion's Connections page — the variables panel will insert the right prefix for
you if you pick one from the list.

| Variable name | What it is |
|---|---|
| `sb_court_1_score1` | team 1's score in the current game on Court 1 |
| `sb_court_1_team1` | team 1's name |
| `sb_court_1_game` | which game/set is up |
| `timer_time` | the presenter clock, ticking |
| `preset_<name>_row` | which spreadsheet row is showing |
| `preset_<name>_label` | that row's label |
| `bl_count` | baseball count, e.g. `2-1` |
| `prompter_section` | the section being read right now |
| `prompter_percent` | how far through the script |
| `prompter_left` | time left at the current speed |
| `prompter_speed` | prompter speed |
| `connection` | connected / disconnected |

Names become variable ids in lower case with anything awkward turned into an
underscore — `Court 1` becomes `court_1`, `Marcus Bell — Head Coach` becomes
`marcus_bell_head_coach`. The full list is in Companion's variables panel.

**Give two things names that differ by more than punctuation.** Because every
run of punctuation and spacing collapses to a single underscore, `Court 1`,
`Court-1` and `Court #1` all arrive at the same id — `court_1`. If two
scoreboards or two library presets land on the same id they share one variable,
and whichever the app lists last is the one you will see, so a button can end up
showing the other one's number. The same goes for the ready-made presets in the
button list, which are keyed the same way.

Nothing is renamed automatically, because the id is what your buttons point at
and moving it would break buttons you have already built. Instead the connection
log warns you and names both culprits — so if a button is showing the wrong
score, look there first.

### If it stops working mid-show

The module reconnects on its own every few seconds, and picks straight back up
when the app comes back. Nothing needs restarting. If the app itself was closed
and reopened, your buttons keep working — they're matched by name.

### Support

mark@streamgraphicspro.com · www.streamgraphicspro.com
