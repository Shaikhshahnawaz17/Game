export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function mobileCheck() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
export function formatRoom(room) {
  return `Room: ${room.roomId} | Host: ${room.hostId.slice(0,4)} | Status: ${room.status}`;
}