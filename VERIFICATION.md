# DRISHTI-AI verification notes

## Latest camera / scan behavior
- Q&A -> continuously tracked eye-only camera -> stable green lock -> loud double buzzer -> 3 / 2 / 1 tones -> shutter effect -> real captured-pixel quality scan -> preliminary urgency result -> report.
- Auto-capture requires MediaPipe eye landmarks. If landmark tracking is unavailable, the app stays in guided manual-capture mode rather than falsely auto-capturing.
- Green lock is continuously validated. Meaningful eye-center movement, loss of landmarks, or eye-size change during countdown cancels the countdown and prevents capture.
- Captured image crop is tightened around one eye.
- Post-capture processing calculates brightness, contrast, detail/sharpness, glare ratio and dark-pixel ratio from the saved image itself.
- Low / Moderate / High / Critical remains a non-diagnostic screening-urgency result. Retinal DR severity requires a fundus image.
- Low urgency does not display an urgent PHC recommendation; instead the UI displays a next self-check interval and routine retinal-screening note.

## Static checks performed
- All `src/**/*.ts` and `src/**/*.tsx` files parsed/transpiled with the installed TypeScript parser: 0 syntax diagnostics.
- `ai_service/app.py` Python bytecode compilation passed.
- Full dependency-resolved `npm run build` still needs to be run locally because project npm dependencies are not installed in this execution environment.

## Required local validation
```bash
npm install
npm run build
```

Then test camera/audio on the deployed HTTPS origin. Browser/system volume must be enabled. Tap **Enable / test sound** once if the browser has not yet unlocked Web Audio.
