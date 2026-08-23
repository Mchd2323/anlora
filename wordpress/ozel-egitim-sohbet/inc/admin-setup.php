<?php
/**
 * Admin setup screen and required plugin notices.
 *
 * @package OzelEgitimSohbet
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Plugins the theme needs to become a working community.
 *
 * @return array
 */
function oec_required_plugins() {
	return array(
		'wpforo'                    => array(
			'file'  => 'wpforo/wpforo.php',
			'name'  => __( 'wpForo Forum', 'ozel-egitim-sohbet' ),
			'role'  => __( 'Sorular, yanıtlar, kategoriler, üyelik, profil, bildirim, spam ve moderatör yetkileri.', 'ozel-egitim-sohbet' ),
		),
		'nextend-facebook-connect'  => array(
			'file'  => 'nextend-facebook-connect/nextend-facebook-connect.php',
			'name'  => __( 'Nextend Social Login', 'ozel-egitim-sohbet' ),
			'role'  => __( 'Google hesabıyla kayıt ve giriş.', 'ozel-egitim-sohbet' ),
		),
	);
}

/**
 * Whether a plugin file is active.
 *
 * @param string $plugin_file Plugin file, relative to the plugins directory.
 * @return bool
 */
function oec_plugin_is_active( $plugin_file ) {
	if ( ! function_exists( 'is_plugin_active' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	return is_plugin_active( $plugin_file );
}

/**
 * Whether a plugin is installed but not activated.
 *
 * @param string $plugin_file Plugin file, relative to the plugins directory.
 * @return bool
 */
function oec_plugin_is_installed( $plugin_file ) {
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	$plugins = get_plugins();

	return isset( $plugins[ $plugin_file ] );
}

/**
 * Nonced install URL for a plugin slug.
 *
 * @param string $slug WordPress.org plugin slug.
 * @return string
 */
function oec_install_plugin_url( $slug ) {
	return wp_nonce_url(
		self_admin_url( 'update.php?action=install-plugin&plugin=' . rawurlencode( $slug ) ),
		'install-plugin_' . $slug
	);
}

/**
 * Nonced activation URL for a plugin file.
 *
 * @param string $plugin_file Plugin file, relative to the plugins directory.
 * @return string
 */
function oec_activate_plugin_url( $plugin_file ) {
	return wp_nonce_url(
		self_admin_url( 'plugins.php?action=activate&plugin=' . rawurlencode( $plugin_file ) ),
		'activate-plugin_' . $plugin_file
	);
}

/**
 * Register the Appearance › Theme setup screen.
 */
function oec_theme_admin_menu() {
	add_theme_page(
		__( 'Tema Kurulumu', 'ozel-egitim-sohbet' ),
		__( 'Tema Kurulumu', 'ozel-egitim-sohbet' ),
		'manage_options',
		'oec-theme-setup',
		'oec_theme_setup_page'
	);
}
add_action( 'admin_menu', 'oec_theme_admin_menu' );

/**
 * Render the setup screen.
 */
function oec_theme_setup_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Bu sayfayı görüntüleme yetkiniz yok.', 'ozel-egitim-sohbet' ) );
	}

	$plugins   = oec_required_plugins();
	$can_install = current_user_can( 'install_plugins' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Özel Eğitim Sohbet — Tema Kurulumu', 'ozel-egitim-sohbet' ); ?></h1>
		<p><?php esc_html_e( 'Temanın gerçek soru–yanıt, üyelik, profil ve Google giriş özellikleri için aşağıdaki eklentileri kurun.', 'ozel-egitim-sohbet' ); ?></p>

		<table class="widefat striped" style="max-width:900px">
			<thead>
				<tr>
					<th><?php esc_html_e( 'Eklenti', 'ozel-egitim-sohbet' ); ?></th>
					<th><?php esc_html_e( 'Görevi', 'ozel-egitim-sohbet' ); ?></th>
					<th><?php esc_html_e( 'Durum', 'ozel-egitim-sohbet' ); ?></th>
					<th><?php esc_html_e( 'İşlem', 'ozel-egitim-sohbet' ); ?></th>
				</tr>
			</thead>
			<tbody>
			<?php foreach ( $plugins as $slug => $plugin ) : ?>
				<?php
				$active    = oec_plugin_is_active( $plugin['file'] );
				$installed = $active || oec_plugin_is_installed( $plugin['file'] );
				?>
				<tr>
					<td><strong><?php echo esc_html( $plugin['name'] ); ?></strong></td>
					<td><?php echo esc_html( $plugin['role'] ); ?></td>
					<td>
						<?php if ( $active ) : ?>
							<span style="color:#16805f;font-weight:600"><?php esc_html_e( 'Etkin', 'ozel-egitim-sohbet' ); ?></span>
						<?php elseif ( $installed ) : ?>
							<span style="color:#8a6d1f;font-weight:600"><?php esc_html_e( 'Kurulu, pasif', 'ozel-egitim-sohbet' ); ?></span>
						<?php else : ?>
							<span style="color:#a34f3e;font-weight:600"><?php esc_html_e( 'Eksik', 'ozel-egitim-sohbet' ); ?></span>
						<?php endif; ?>
					</td>
					<td>
						<?php if ( $active ) : ?>
							&mdash;
						<?php elseif ( $installed && current_user_can( 'activate_plugins' ) ) : ?>
							<a class="button button-primary" href="<?php echo esc_url( oec_activate_plugin_url( $plugin['file'] ) ); ?>"><?php esc_html_e( 'Etkinleştir', 'ozel-egitim-sohbet' ); ?></a>
						<?php elseif ( $can_install ) : ?>
							<a class="button button-primary" href="<?php echo esc_url( oec_install_plugin_url( $slug ) ); ?>"><?php esc_html_e( 'Kur', 'ozel-egitim-sohbet' ); ?></a>
						<?php else : ?>
							<?php esc_html_e( 'Yönetici kurmalı', 'ozel-egitim-sohbet' ); ?>
						<?php endif; ?>
					</td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Kurulumdan sonra', 'ozel-egitim-sohbet' ); ?></h2>
		<ol>
			<li><?php esc_html_e( 'wpForo etkinleşince oluşturulan /community/ sayfasını kontrol edin.', 'ozel-egitim-sohbet' ); ?></li>
			<li><?php esc_html_e( 'wpForo → Forumlar bölümünden kategorileri ve alt forumları oluşturun. Ana sayfadaki konu listesi bu forumlardan beslenir.', 'ozel-egitim-sohbet' ); ?></li>
			<li><?php esc_html_e( 'wpForo → Ayarlar → Giriş ve Kayıt bölümünden üyeliği etkinleştirin.', 'ozel-egitim-sohbet' ); ?></li>
			<li><?php esc_html_e( 'wpForo → Üye Grupları bölümünden moderatör yetkilerini sınırlayın. Grup adları ana sayfadaki rozetlerde görünür.', 'ozel-egitim-sohbet' ); ?></li>
			<li><?php esc_html_e( 'Nextend ayarlarında Google sağlayıcısını etkinleştirip Google istemci bilgilerini girin.', 'ozel-egitim-sohbet' ); ?></li>
			<li><?php esc_html_e( 'Görünüm → Düzenleyici bölümünden renkleri, üst menüyü, footerı ve tüm sabit metinleri değiştirebilirsiniz.', 'ozel-egitim-sohbet' ); ?></li>
		</ol>

		<h2><?php esc_html_e( 'Tema kısa kodları', 'ozel-egitim-sohbet' ); ?></h2>
		<p><?php esc_html_e( 'Bu kısa kodları Düzenleyici içinde herhangi bir şablona ekleyebilirsiniz:', 'ozel-egitim-sohbet' ); ?></p>
		<ul style="list-style:disc;margin-left:20px">
			<li><code>[oec_discussions limit="6"]</code> — <?php esc_html_e( 'arama, sıralama ve konuşma kartları.', 'ozel-egitim-sohbet' ); ?></li>
			<li><code>[oec_topics]</code> — <?php esc_html_e( 'forum başlıkları ve konu sayıları.', 'ozel-egitim-sohbet' ); ?></li>
			<li><code>[oec_stats]</code> — <?php esc_html_e( 'topluluk sayaçları.', 'ozel-egitim-sohbet' ); ?></li>
			<li><code>[oec_account]</code> — <?php esc_html_e( 'giriş/üye ol veya profil ve çıkış bağlantısı.', 'ozel-egitim-sohbet' ); ?></li>
			<li><code>[oec_ask_button]</code> — <?php esc_html_e( 'yeni soru formuna giden düğme.', 'ozel-egitim-sohbet' ); ?></li>
			<li><code>[oec_privacy_warning]</code> — <?php esc_html_e( 'mahremiyet uyarısı kutusu.', 'ozel-egitim-sohbet' ); ?></li>
		</ul>
	</div>
	<?php
}

/**
 * Admin notice listing the plugins that are still missing.
 */
function oec_theme_missing_plugins_notice() {
	if ( ! current_user_can( 'install_plugins' ) ) {
		return;
	}

	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen && 'appearance_page_oec-theme-setup' === $screen->id ) {
		return;
	}

	$missing = array();
	foreach ( oec_required_plugins() as $plugin ) {
		if ( ! oec_plugin_is_active( $plugin['file'] ) ) {
			$missing[] = $plugin['name'];
		}
	}

	if ( ! $missing ) {
		return;
	}

	printf(
		'<div class="notice notice-warning"><p><strong>%1$s</strong> %2$s <a href="%3$s">%4$s</a></p></div>',
		esc_html__( 'Özel Eğitim Sohbet:', 'ozel-egitim-sohbet' ),
		esc_html(
			sprintf(
				/* translators: %s: comma separated plugin names. */
				__( 'Gerekli eklentiler eksik: %s.', 'ozel-egitim-sohbet' ),
				implode( ', ', $missing )
			)
		),
		esc_url( admin_url( 'themes.php?page=oec-theme-setup' ) ),
		esc_html__( 'Kurulum ekranını açın', 'ozel-egitim-sohbet' )
	);
}
add_action( 'admin_notices', 'oec_theme_missing_plugins_notice' );
