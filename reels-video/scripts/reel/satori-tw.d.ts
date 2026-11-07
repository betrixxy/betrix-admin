// Kökteki kart şablonları Satori'nin `tw` özelliğini kullanır; kökte bu tip satori paketinden gelir, bu pakette satori yok.
// Betikler kökün fotoğraf hattını (yüz, kırpma, büyütme) içe aktarınca şablonlar da tip denetimine girer.
import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    tw?: string;
  }
}
