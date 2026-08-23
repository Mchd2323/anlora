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

		<h2><?php esc_html_e( 'Forum ↔ Tema bağlantısı', 'ozel-egitim-sohbet' ); ?></h2>
		<?php oec_render_forum_binding_panel(); ?>

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

/**
 * Live view of the wpForo forum tree exactly as the theme reads it.
 *
 * The point of this panel is to make the binding visible: what you see here
 * is what the site's category rail shows, because both come from the same
 * wpForo query. There is no second list to keep in step.
 */
function oec_render_forum_binding_panel() {
	if ( ! oec_wpforo_active() || ! oec_wpforo_table( 'forums' ) ) {
		?>
		<p><?php esc_html_e( 'wpForo kurulduktan sonra forum kategorileriniz burada ve sitenin sol tarafındaki listede kendiliğinden görünür.', 'ozel-egitim-sohbet' ); ?></p>
		<?php
		return;
	}

	$tree = oec_get_forum_tree();
	$qa   = oec_qa_layout_active();
	?>
	<p>
		<?php esc_html_e( 'Sitedeki kategori listesi ayrı bir yerde tutulmaz; doğrudan aşağıdaki wpForo yapısından okunur. wpForo\'da kategori veya forum eklediğinizde, adını değiştirdiğinizde, sırasını değiştirdiğinizde ya da sildiğinizde site anında aynısını gösterir.', 'ozel-egitim-sohbet' ); ?>
	</p>

	<?php if ( false === $qa ) : ?>
		<div class="notice notice-info inline" style="margin:12px 0;max-width:900px">
			<p>
				<strong><?php esc_html_e( 'Öneri:', 'ozel-egitim-sohbet' ); ?></strong>
				<?php esc_html_e( 'Forumlarınız klasik düzende. wpForo → Forumlar bölümünde her forumu düzenleyip "Layout" ayarını Q&A yaparsanız soru–yanıt yapısı, oylama ve "en iyi yanıt" işaretlemesi açılır; ana sayfadaki "yararlı" ve "Çözüldü" göstergeleri de bu veriyle dolar.', 'ozel-egitim-sohbet' ); ?>
			</p>
		</div>
	<?php endif; ?>

	<?php if ( ! $tree ) : ?>
		<p><em><?php esc_html_e( 'Henüz forum yok. wpForo → Forumlar bölümünden bir kategori ve altına en az bir forum ekleyin; boş kategoriler sitede görünmez.', 'ozel-egitim-sohbet' ); ?></em></p>
	<?php else : ?>
		<table class="widefat striped" style="max-width:900px">
			<thead>
				<tr>
					<th><?php esc_html_e( 'Kategori / Forum', 'ozel-egitim-sohbet' ); ?></th>
					<th style="width:110px"><?php esc_html_e( 'Konu', 'ozel-egitim-sohbet' ); ?></th>
					<th style="width:130px"><?php esc_html_e( 'Düzen', 'ozel-egitim-sohbet' ); ?></th>
					<th style="width:150px"><?php esc_html_e( 'Sitede', 'ozel-egitim-sohbet' ); ?></th>
				</tr>
			</thead>
			<tbody>
			<?php foreach ( $tree as $group ) : ?>
				<?php if ( $group['title'] ) : ?>
					<tr>
						<td colspan="4" style="background:#f2f6f3"><strong><?php echo esc_html( $group['title'] ); ?></strong></td>
					</tr>
				<?php endif; ?>
				<?php foreach ( $group['forums'] as $forum ) : ?>
					<tr>
						<td style="padding-left:24px"><?php echo esc_html( $forum['title'] ); ?></td>
						<td><?php echo esc_html( number_format_i18n( $forum['topics'] ) ); ?></td>
						<td><?php echo esc_html( oec_layout_label( $forum['layout'] ) ); ?></td>
						<td>
							<a href="<?php echo esc_url( home_url( '/?forum=' . $forum['forumid'] . '#konusmalar' ) ); ?>"><?php esc_html_e( 'Listede gör', 'ozel-egitim-sohbet' ); ?></a>
						</td>
					</tr>
				<?php endforeach; ?>
			<?php endforeach; ?>
			</tbody>
		</table>
	<?php endif; ?>

	<p>
		<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=wpforo-forums' ) ); ?>"><?php esc_html_e( 'wpForo → Forumlar', 'ozel-egitim-sohbet' ); ?></a>
		<a class="button" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Siteyi görüntüle', 'ozel-egitim-sohbet' ); ?></a>
	</p>
	<?php
}

/**
 * Human readable wpForo layout name.
 *
 * @param int $layout Layout id, or -1 when unknown.
 * @return string
 */
function oec_layout_label( $layout ) {
	$layouts = array(
		0 => __( 'Genişletilmiş', 'ozel-egitim-sohbet' ),
		1 => __( 'Sade', 'ozel-egitim-sohbet' ),
		2 => __( 'İç içe', 'ozel-egitim-sohbet' ),
		3 => __( 'Q&A', 'ozel-egitim-sohbet' ),
	);

	$layout = (int) $layout;

	return isset( $layouts[ $layout ] ) ? $layouts[ $layout ] : '—';
}
