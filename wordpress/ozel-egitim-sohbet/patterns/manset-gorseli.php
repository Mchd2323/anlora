<?php
/**
 * Title: Manşet görseli
 * Slug: ozel-egitim-sohbet/manset-gorseli
 * Categories: featured
 * Description: Manşetin sağına yaslanan, sola doğru silikleşen görsel.
 * Inserter: no
 *
 * Görseli değiştirmek için: Görünüm > Düzenleyici > Ana Sayfa şablonunu açın,
 * görsele tıklayın ve araç çubuğundaki "Değiştir" ile kendi fotoğrafınızı
 * yükleyin. Sağa yaslama ve silikleşme efekti temadan gelir, fotoğraf
 * değişince de aynen çalışır.
 *
 * @package OzelEgitimSohbet
 */

?>
<!-- wp:group {"className":"oec-hero-media","layout":{"type":"default"}} -->
<div class="wp-block-group oec-hero-media"><!-- wp:image {"className":"oec-hero-image","linkDestination":"none"} -->
<figure class="wp-block-image oec-hero-image"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/img/hero.svg' ) ); ?>" alt="<?php esc_attr_e( 'Bir yetişkin ve bir çocuk yan yana oturmuş birlikte kitap okuyor', 'ozel-egitim-sohbet' ); ?>"/></figure>
<!-- /wp:image --></div>
<!-- /wp:group -->
