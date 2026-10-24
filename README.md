# Game Night – local leaderboard on a Raspberry Pi 3B

| Page | Address |
|---|---|
| TV dashboard | `http://192.168.4.1/` |
| Player view | `http://192.168.4.1/<player-name>` (e.g. `/anna`, `/peter`) |
| Admin | `http://192.168.4.1/admin` |

## 1. Install Raspberry Pi OS
1. Use Raspberry Pi Imager to write **Raspberry Pi OS Lite (64-bit, Bookworm)** to the SD card.
2. In the Imager settings: user `pi`, a password, enable SSH, set your Wi-Fi country (e.g. `AT`). For setup, connect the Pi to the internet with a **LAN cable**.
3. Log in via SSH and install the packages:
```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y nodejs npm curl cage chromium
```
(On older systems the package is called `chromium-browser`; adjust the path in `deploy/kiosk.service`.)

## 2. Install the project
Copy the `gamenight` folder to `/home/pi/gamenight` (via `scp` or USB stick), then:
```bash
cd ~/gamenight
npm install --omit=dev
```
If no prebuilt binary is found for `better-sqlite3`, run `sudo apt install -y build-essential python3` and `npm install` again (Python is only needed by the build tool).

Edit `config.json`: `ssid`, `password` (at least 8 characters), optionally `adminPin` (keeps other players out of the admin panel) and the `points` table (1st place, 2nd place, ...).

## 3. Wi-Fi hotspot (NetworkManager)
```bash
sudo nmcli con add type wifi ifname wlan0 con-name GameNight autoconnect yes ssid "GameNight" \
  mode ap 802-11-wireless.band bg ipv4.method shared ipv4.addresses 192.168.4.1/24 \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "gamenight1234"
sudo nmcli con up GameNight
```
SSID and password must match `config.json` (they end up in the Wi-Fi QR code). `ipv4.method shared` starts DHCP/DNS automatically, so `hostapd` and `dnsmasq` are not needed. The hotspot now starts on every boot. Note: while the hotspot is active, the Wi-Fi chip has no internet access, so use the LAN cable for updates.

## 4. Autostart for server and kiosk
```bash
sudo cp deploy/gamenight.service deploy/kiosk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gamenight.service
sudo systemctl enable kiosk.service
sudo systemctl set-default graphical.target
sudo reboot
```
After the reboot the TV shows the dashboard in fullscreen. The server binds to port 80 without root with `AmbientCapabilities`.

## 5. Running the game night
1. Connect a phone or laptop to the hotspot and open `http://192.168.4.1/admin`.
2. Under **Players**, add the Current Players. **QR codes** shows two codes per player: scan the Wi-Fi code first, then the page code. *Print* creates handouts.
3. Under **Races**, create a race, click it and enter the places. Points are filled from the points table but can be overridden. Saving updates the TV and all phones instantly.

## Maintenance
- Data lives in `data.db`. Back it up, or delete it (and restart the service) to reset everything.
- Logs: `journalctl -u gamenight -f` and `journalctl -u kiosk -f`
- Restart the kiosk: `sudo systemctl restart kiosk`
- TV stays black? Check `journalctl -u kiosk` and verify the Chromium path (`which chromium`).
- Scanning the Wi-Fi QR code works with current Android and iOS cameras. Otherwise connect manually.
