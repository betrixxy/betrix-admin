/**
 * Deploy sırası (`up -d`'den ÖNCE): çalışan app ve scheduler konteynerlerinin günlüklerini sır taramasından
 * geçirip `<çıktı>/<tarih-saat>-<servis>.log` olarak kaydeder, 30 günden eski günlükleri siler. Konteyner
 * yeniden oluşturulunca günlüğü kaybolur (2026-10-29: Maç Sonucu teşhisinde 21:05–21:20 günlüğü yoktu).
 * Çıktıda yalnızca satır ve maskeleme SAYILARI yazılır — hiçbir değer yazdırılmaz.
 *
 *   npx tsx scripts/save-container-logs.ts --env .env.production --out ../backups/logs [--stamp 20261029-2237]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isExpired, redactLog, secretValues } from "@/lib/ops/log-redact";

const SERVICES = ["app", "scheduler"] as const;
const PROJECT = "betrix";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function stampNow(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function containerOf(service: string): string | null {
  const ids = execFileSync("docker", ["ps", "-q", "--filter", `label=com.docker.compose.project=${PROJECT}`, "--filter", `label=com.docker.compose.service=${service}`], { encoding: "utf8" }).trim();
  return ids.split(/\s+/u)[0] || null;
}

function main(): void {
  const envPath = arg("env") ?? ".env.production";
  const outDir = path.resolve(arg("out") ?? path.join("..", "backups", "logs"));
  const stamp = arg("stamp") ?? stampNow();
  const secrets = secretValues(readFileSync(envPath, "utf8"));
  mkdirSync(outDir, { recursive: true });

  for (const service of SERVICES) {
    const id = containerOf(service);
    if (!id) {
      console.log(`${service}: çalışan konteyner yok — atlandı`);
      continue;
    }
    // stdout + stderr birlikte, zaman damgalı; rotasyonda tutulan bütün dosyalar (compose: 10 MB × 5).
    const logs = spawnSync("docker", ["logs", "--timestamps", id], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (logs.status !== 0) throw new Error(`${service}: docker logs başarısız (çıkış ${String(logs.status)})`);
    // Zaman damgalı satırlar sıralanınca stdout ile stderr (Next hataları) tek akışta birleşir.
    const combined = `${logs.stdout}\n${logs.stderr}`.split("\n").filter(Boolean).sort().join("\n");
    const { text, envHits, patternHits } = redactLog(combined, secrets);
    const file = path.join(outDir, `${stamp}-${service}.log`);
    writeFileSync(file, text, { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      // Windows'ta izin biti yok sayılır
    }
    const envCount = Object.values(envHits).reduce((sum, value) => sum + value, 0);
    const patternCount = Object.values(patternHits).reduce((sum, value) => sum + value, 0);
    const lines = text.split("\n").length;
    console.log(`${service}: ${lines} satır → ${path.basename(file)} · maskelenen: ${envCount} env değeri (${Object.keys(envHits).join(", ") || "-"}), ${patternCount} desen (${Object.keys(patternHits).join(", ") || "-"})`);
  }

  const now = Date.now();
  const removed = readdirSync(outDir).filter((name) => name.endsWith(".log") && isExpired(statSync(path.join(outDir, name)).mtimeMs, now));
  for (const name of removed) unlinkSync(path.join(outDir, name));
  console.log(`30 günden eski silinen günlük: ${removed.length}`);
}

main();
