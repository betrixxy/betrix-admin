/** Eski kayıtlar SVG, yeniler PNG olabilir — indirme adı dosyanın gerçek uzantısını izler. */
function fileExtension(url: string): string {
  return /\.([a-z0-9]+)$/i.exec(url)?.[1]?.toLowerCase() ?? "png";
}

/**
 * Görselleri dizilim sırasıyla indirir: tek görselde `<ad>.png`, çoklu düzende `<ad>-1.png`, `<ad>-2.png`…
 * (carousel yükleme sırası dosya adından okunur). Ardışık `a.download` — yeni bağımlılık (JSZip) yok;
 * tarayıcı birden fazla indirme için bir kez izin isteyebilir.
 */
export async function downloadSequence(urls: string[], baseName: string): Promise<void> {
  for (const [index, url] of urls.entries()) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = urls.length > 1 ? `${baseName}-${index + 1}.${fileExtension(url)}` : `${baseName}.${fileExtension(url)}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Ardışık indirmeler tarayıcıda birbirini iptal etmesin.
    if (index < urls.length - 1) await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
