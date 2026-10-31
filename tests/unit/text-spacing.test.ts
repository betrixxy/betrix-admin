import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { textSpacingProblems } from "@/lib/dashboard/text-spacing";
import { cardTexts } from "@/lib/prediction/content-language";
import { tidyText, tightenTree } from "@/skills/render-engine/satori-text";

/**
 * Çift boşluk bekçisi — BÜTÜN şablonlar (canlı test 2026-10-31: Vitrin manşeti "Modelimiz Trabzonspor  diyor").
 * (1) Render sınırı (`renderSatori` → `tightenTree`) veri kaynaklı ardışık boşluğu tek boşluğa indirir; künye
 * ayıracı "  ·  " bilerek geniş kalır. (2) Şablon kaynaklarında ayıraç dışı çift boşluklu metin sabiti yok.
 * (3) Kart verisi baş/son boşluk ve çift boşluk taşımaz — `lib/dashboard/text-spacing.ts::textSpacingProblems`,
 * görsel testler her kart nesnesini bundan geçirir. Gönderi metinleri `caption-rules.test.ts`'te (aynı kural).
 */

const NBSP = String.fromCharCode(0xa0);

describe("çift boşluk bekçisi", () => {
  it("render sınırı: ardışık boşluk tek boşluğa iner, künye ayıracı korunur", () => {
    assert.equal(tidyText("Modelimiz  Trabzonspor   diyor"), "Modelimiz Trabzonspor diyor");
    assert.equal(tidyText("TRENDYOL SÜPER LİG  ·  10. HAFTA"), "TRENDYOL SÜPER LİG  ·  10. HAFTA");
    assert.equal(tidyText(`  ·  A`), `  ·  A`);
    assert.equal(tidyText(`A${NBSP}${NBSP}${NBSP}B`), `A${NBSP}${NBSP}${NBSP}B`);
    const strings: string[] = [];
    const collect = (node: unknown): void => {
      if (typeof node === "string") strings.push(node);
      else if (Array.isArray(node)) node.forEach(collect);
      else if (node && typeof node === "object" && "props" in node) collect((node as { props: { children?: unknown } }).props.children);
    };
    collect(tightenTree(createElement("div", null, createElement("span", null, "Modelimiz  Göztepe  diyor"))));
    const text = strings[0];
    assert.equal(text, ["Modelimiz", "Göztepe", "diyor"].join(NBSP));
  });

  it("şablon kaynakları: ayıraç dışında çift boşluklu metin sabiti yok", () => {
    const root = path.join(process.cwd(), "src", "skills", "render-engine", "templates");
    // Görünmeyen ölçü dizgisi (yalnızca punto hesabı; çizilmez).
    const allowed = new Set(["match-analysis/timeline-vertical.tsx:const withDetail = row.detail ? `${main}   ${row.detail}` : main;"]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/u.test(name)) files.push(full);
      }
    };
    walk(root);
    assert.ok(files.length > 20);
    const problems: string[] = [];
    for (const file of files) {
      const rel = path.relative(root, file).replaceAll("\\", "/");
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) continue;
        for (const literal of code.match(/"[^"\n]*"|`[^`\n]*`|'[^'\n]*'/gu) ?? []) {
          if (/(?<![·\s]) {2,}(?![·\s])/u.test(literal) && !allowed.has(`${rel}:${code}`)) problems.push(`${rel}: ${code}`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  it("kart verisi: baş/son ve çift boşluk yakalanır; cardTexts ile aynı alanlar", () => {
    const card = { title: "Modelimiz  Göztepe diyor", label: " GÖZTEPE", footer: "SÜPER LİG  ·  10. HAFTA", hex: "#FFD200" };
    assert.deepEqual(textSpacingProblems(card), ['kart.title: çift boşluk "Modelimiz  Göztepe diyor"', 'kart.label: baş/son boşluk " GÖZTEPE"']);
    assert.ok(Object.keys(cardTexts(card)).includes("kart.title"));
  });
});
