export interface RemovePlayerBackgroundResult {
  /** Alfa kanallı, arka planı temizlenmiş görselin URL'i */
  transparentImageUrl: string;
  width: number;
  height: number;
}

export interface GenerateStadiumBackgroundResult {
  imageUrl: string;
  /** Flux'a gönderilen nihai prompt — hata ayıklama ve tekrar üretim için saklanır */
  prompt: string;
}
