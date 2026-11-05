import { spawn } from "node:child_process";
import { connect } from "node:net";
import { REELS_LOCAL_PORT } from "./setup-env";

/** Reels servisine geçici yerel yönlendirme: normal `ssh mac` bağlantısı, tünel anahtarı kullanılmaz. Bitince kapanır. */

const portOpen = (port: number): Promise<boolean> => new Promise((resolve) => {
  const socket = connect({ port, host: "127.0.0.1" });
  socket.setTimeout(1000);
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
  socket.once("timeout", () => { socket.destroy(); resolve(false); });
});

export async function withReelsTunnel<T>(work: () => Promise<T>): Promise<T> {
  if (await portOpen(REELS_LOCAL_PORT)) throw new Error(`${REELS_LOCAL_PORT} portu dolu: önceki yönlendirme açık kalmış olabilir.`);
  const child = spawn("ssh", ["-N", "-T", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ConnectTimeout=15", "-L", `${REELS_LOCAL_PORT}:127.0.0.1:8011`, "mac"], { stdio: "ignore" });
  try {
    for (let attempt = 0; !(await portOpen(REELS_LOCAL_PORT)); attempt += 1) {
      if (child.exitCode !== null) throw new Error("ssh mac yönlendirmesi kurulamadı.");
      if (attempt >= 40) throw new Error("ssh mac yönlendirmesi 20 sn içinde açılmadı.");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return await work();
  } finally {
    child.kill();
  }
}
