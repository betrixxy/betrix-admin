/**
 * "Canlı taktik tahtası" giriş noktası (`reel-render.ts --format tactical`):
 *   --stil-testi  ADIM 1, hook + kazanma ihtimali, önbellekteki sesle (`style-test.ts`)
 *   --plan | --stills | --full  7 beat'lik tam video (`full.ts`)
 */
if (process.argv.includes("--stil-testi")) await import("./style-test");
else await import("./full");

export {};
