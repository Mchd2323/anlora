<?php
/**
 * Title: Topluluk çalışma alanı
 * Slug: ozel-egitim-sohbet/topluluk-calisma-alani
 * Categories: featured, posts
 * Description: Solda konu listesi, ortada konuşmalar, sağda rehber ve sayaç kartları.
 *
 * @package OzelEgitimSohbet
 */

?>
<!-- wp:group {"className":"oec-shell oec-workspace","layout":{"type":"default"}} -->
<div class="wp-block-group oec-shell oec-workspace">

<!-- wp:group {"className":"oec-rail oec-rail--start","layout":{"type":"default"}} -->
<div class="wp-block-group oec-rail oec-rail--start">
<!-- wp:group {"className":"oec-card oec-topic-card","layout":{"type":"default"}} -->
<div class="wp-block-group oec-card oec-topic-card">
<!-- wp:heading {"level":2,"fontSize":"medium"} --><h2 class="wp-block-heading has-medium-font-size"><?php esc_html_e( 'Konular', 'ozel-egitim-sohbet' ); ?></h2><!-- /wp:heading -->
<!-- wp:shortcode -->[oec_topics]<!-- /wp:shortcode -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->

<!-- wp:group {"className":"oec-community-main","layout":{"type":"default"}} -->
<div class="wp-block-group oec-community-main">
<!-- wp:shortcode -->[oec_discussions limit="6"]<!-- /wp:shortcode -->
</div>
<!-- /wp:group -->

<!-- wp:group {"className":"oec-rail oec-rail--end","layout":{"type":"default"}} -->
<div class="wp-block-group oec-rail oec-rail--end">
<!-- wp:group {"className":"oec-card oec-stat-card","layout":{"type":"default"}} -->
<div class="wp-block-group oec-card oec-stat-card">
<!-- wp:heading {"level":2,"fontSize":"medium"} --><h2 class="wp-block-heading has-medium-font-size"><?php esc_html_e( 'Bugün toplulukta', 'ozel-egitim-sohbet' ); ?></h2><!-- /wp:heading -->
<!-- wp:shortcode -->[oec_stats]<!-- /wp:shortcode -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->

</div>
<!-- /wp:group -->
