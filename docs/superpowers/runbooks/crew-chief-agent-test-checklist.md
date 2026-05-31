# Crew Chief Agent — test checklist (pre-race)

Run before **June 10 code freeze**. Goal: 3 family/friend testers plus failure drills.

---

## A. Automated smoke test

With the API reachable (tunnel or local):

```bash
./scripts/verify-agent.sh https://YOUR-TUNNEL-URL
```

All checks should pass.

---

## B. Happy path (each tester)

- [ ] Open https://harveygerardMK.github.io/crew-chief/agent/ on **mobile** (Safari or Chrome)
- [ ] Complete onboarding (name + relationship)
- [ ] Receive **greeting** without typing first
- [ ] Ask: *"How is Harvey doing?"*
- [ ] Reply sounds like Harvey (not generic assistant)
- [ ] **Status strip** shows mile/speed or **pre-race** before June 12
- [ ] **Art card** appears (image or caption-only if Commons fails)
- [ ] Close tab, reopen — **return visit** greeting mentions name / prior check-in
- [ ] Link to **Crew site** works

### Sample questions by relationship

| Relationship | Try asking |
|--------------|------------|
| **Family** | "Should I be worried?" / "Is he eating?" |
| **Friend** | "How bad is it really?" / "What's the dumbest thing he's done so far?" |
| **Crew** | "What does he need at the next stop?" / "Status for handoff?" |
| **Pacer** | "When might I jump in?" / "What pace is he holding?" |
| **Stranger** | "What is the Tahoe 200?" / "Why would anyone run 200 miles?" |

Record tester name, device, date, anything weird.

---

## C. Failure drills (ops)

| Drill | How | Expected |
|-------|-----|----------|
| **All drills (guided)** | On droplet: `bash scripts/run-failure-drills.sh` | Step-by-step with restore prompts |
| **Poller stopped** | Stop cron / don't run poller for 10 min | `/status` stale; chat says last known position; UI badge warns |
| **TrackLeaders unreachable** | Bad slug in `poller/.env` | `data_stale: true`; cached miles preserved |
| **Claude down** | Unset `ANTHROPIC_API_KEY`, restart API | `/chat` returns `fallback.md`, `"fallback": true` |
| **Backend down** | `pm2 stop crew-chief-api` | UI shows cached status + error on send |
| **Airplane mode** | Toggle offline mid-chat | Cached status strip; send fails gracefully |

Restore service after each drill.

---

## D. Content sign-off (Harvey)

- [x] Read full **`voice.md`** — approved 2026-05-31
- [ ] Test as **family** relationship vs **friend** — tone should differ
- [ ] Confirm agent **never speculates DNF** without tracker proof
- [ ] Sign-off date: 2026-05-31

---

## E. Race-week config

- [ ] On droplet: `sudo bash scripts/race-week-switch.sh` (sets `tahoe20026` + Harvey Schaefer)
- [ ] Manual poller run writes fresh `harvey_status.json`
- [ ] `PUBLIC_AGENT_API_URL` matches live tunnel
- [ ] PM2 + cron survive reboot (`pm2 startup`, crontab saved)

---

## Tester log

| # | Name | Relationship | Date | Issues |
|---|------|--------------|------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
