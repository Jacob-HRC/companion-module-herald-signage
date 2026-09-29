## Herald Signage

Drive your Herald screens from a Stream Deck: switch playlists and live streams, turn screens on and off, and start or end an emergency override. Buttons can light up to show what's happening, like an override being live, a screen dropping offline, or a stream having trouble.

### Setup

1. In Herald, open your **account page** and create an **API token**. It starts with `hrd_pat_`.
2. Add a Herald Signage connection here. Enter the address you sign in to Herald at (for example `https://yourchurch.heraldsignage.com`) and paste the token.
3. Look under **Presets** for ready-made buttons, or add any action below to your own buttons.

The token acts as the person who made it. It can drive the screens they can, and it stops working if they lose access. Starting or ending an emergency override and restarting players need an **admin's** token. Anything else needs at least an operator.

### Actions

- Play a playlist on a screen, or on a group
- Show a picture or video, or a web page, on a screen
- Show a live stream on a screen or group, and stop it on a screen
- Start an emergency override, end a particular one, or **end whichever override is live**
- Turn a screen on or off
- Restart playback on a screen, or reboot its player

Dropdowns list the screens, playlists and streams your token can reach, by name. They refresh every five minutes, and whenever you save the connection.

### Feedbacks

- Emergency override is live (any override, or a particular one)
- Screen is online
- Screen power is on or off ("off" includes standby)
- Screen is showing a playlist, stream, web page or media item
- Stream health is healthy, having a problem, or idle
- Connected to Herald

### Variables

`override_active`, `override_name`, `screens_online`, `screens_total`, `streams_healthy`, `last_update`

### Good to know

- Button colours follow what Herald hears back from the screens, and refresh every few seconds (you can change the interval). After a press, the module checks again straight away.
- If a press fails, the reason is in Companion's log, for example "The device isn't connected right now".
- Settings → Integrations in Herald lists the same actions, and can show you the exact request each one sends.
