// Use the LAN IP that your iPhone can reach (same Wi-Fi)
// Example: http://192.168.0.10:5555
export const SERVER = 'http://192.168.0.122:5555'; // TODO: update to your server

export const wsURL = (camId) =>
  SERVER.replace(/^http/i, 'ws') + `/ws/${camId}`;

export const streamURL = (camId) =>
  `${SERVER}/stream/${camId}`; // (not used on iOS, kept for completeness)
