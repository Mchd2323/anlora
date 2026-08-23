/**
 * Fonetik yazımı ekrana basmak için normalleştirir.
 *
 * Oxford çekirdeğindeki kayıtlar eğik çizgileri zaten taşır (`/əˈbaʊt/`), ama
 * kullanıcının kendi eklediği kartlarda çoğu zaman yalnızca sesler yazılır
 * (`əˈbaʊt`). İki kaynağı da tek bir sunumda toplarız; aksi hâlde biri
 * `//əˈbaʊt//` gibi çift sınırlayıcıyla görünür.
 */
export function formatPhonetic(raw?: string | null): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  const inner = value.replace(/^\/+/, '').replace(/\/+$/, '').trim();
  if (!inner) return null;
  return `/${inner}/`;
}
