# Car Mode

A car theme for Chrome, built from real photos, real videos and real engine recordings.

- **Ignition:** the first new tab after Chrome starts is a cockpit. Your pointer becomes a key. Click the start button to insert it, enter the PIN (demo **1234**), and the engine starts with a real recording while the tachometer sweeps. Moving the mouse turns the steering wheel, holding the mouse button revs the engine, and **Drive** takes you to the new tab.
- **New tab:** a drift video (red S13 in tire smoke, or a night FPV chase) or one of 13 sports-car photos. Smoke rolls across the whole page when the car drifts.
- **Page car:** a real Ferrari (cut out from a photo) drives around every page, YouTube included. It runs along the inside edges like a stunt track: along the bottom, up the right side, upside-down across the top and down the left, drifting through the corners in tire smoke. Hovering over it stops it. All tabs share one clock, so it keeps its place when you switch tabs. You can also switch it to **Follow tab** mode, where it parks above your active tab and drives forward or reverses when you switch.
- **Game mode:** take the wheel on any website. Click the car → **Drive it** (or **Alt+Shift+D**), then **W A S D / arrows** to drive, **Space** for nitro, **Shift** to drift, **H** for the horn and **Esc** to stop. The car can go anywhere on the page, and driving into the top or bottom edge scrolls the page. A speedometer and nitro bar show bottom left.
- **User guide:** opens on first install, and anytime from the quick menu or **Controls › More**. It explains every feature with screenshots and can be saved as a PDF.
- **Quick menu:** click the car (or press **Alt+Shift+C**) for screenshot (saved to `Downloads/Car Mode`), reload, back/forward, new/duplicate/close tab, mute, pin, zoom in/out/reset, full screen, scroll to top/bottom, mini player (picture-in-picture for videos), read aloud, high contrast, dark page, copy link, translate, print, horn, and park the car. Everything is keyboard-accessible, and Esc closes the menu.
- **Paint shop:** paint the car any color, or a two-color gradient (Gulf, Sunset, Galaxy and more, or your own). The real reflections and shading are kept.
- **Accent colors:** any color or gradient for Car Mode's buttons, switches, new tab and ignition screen.
- **Chrome theme builder:** pick a carbon, solid or gradient tab bar plus an active-tab color, with a live preview. **Create theme** saves a ready theme folder to `Downloads/Car Mode Theme/`, which you load once from `chrome://extensions` (Chrome only lets themes change its own window).
- **Sounds:** engine start, a quieter nitro burst on new tab, a car driving away on close, and anything you like on tab switch. Every event is selectable.
- **Controls:** click the red car icon in the toolbar. The side panel has everything: wallpaper, top car, smoke level, ignition and PIN, sounds and volume.
- **Default Chrome theme:** a carbon-fiber tab bar with a clearly lighter active tab (the `theme/` folder).

No accounts, no servers, no tracking. Code: MIT. Media and icons: free licenses, credited in [CREDITS.md](CREDITS.md).

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Click **Load unpacked** again and pick the `theme` folder inside it.
4. Open a new tab (choose **Keep it** if Chrome asks).

The page car appears on regular websites and hides when a video goes full screen. Chrome doesn't allow extensions on `chrome://` pages or the Web Store.

## Files

```
manifest.json         extension manifest
background.js         engine sounds for browser events, top-car tab positions
offscreen/            hidden page that plays audio
content/car.js        the page car, smoke and quick menu
newtab/               new tab (wallpaper, smoke) and ignition screen
sidepanel/            control center
guide/                user guide (opens on install) + screenshots
shared/               settings, sound clips, player, smoke renderer, base styles
assets/               photos, videos, cockpit, car cutout, sounds, smoke textures, Tabler icons
theme/                separate Chrome theme (load it on its own)
```
