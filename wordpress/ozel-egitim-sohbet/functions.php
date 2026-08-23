<?php
/**
 * Özel Eğitim Sohbet theme functions.
 *
 * @package OzelEgitimSohbet
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'OEC_THEME_VERSION', '1.1.0' );

require_once get_theme_file_path( 'inc/wpforo-data.php' );
require_once get_theme_file_path( 'inc/shortcodes.php' );
require_once get_theme_file_path( 'inc/admin-setup.php' );

/**
 * Theme supports and translation files.
 */
function oec_theme_setup() {
	load_theme_textdomain( 'ozel-egitim-sohbet', get_theme_file_path( 'languages' ) );

	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'editor-styles' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_editor_style( array( 'style.css', 'assets/css/editor.css' ) );
}
add_action( 'after_setup_theme', 'oec_theme_setup' );

/**
 * Front end assets.
 */
function oec_theme_assets() {
	wp_enqueue_style( 'oec-theme', get_stylesheet_uri(), array(), OEC_THEME_VERSION );

	wp_enqueue_script( 'oec-theme', get_theme_file_uri( 'assets/js/theme.js' ), array(), OEC_THEME_VERSION, true );
}
add_action( 'wp_enqueue_scripts', 'oec_theme_assets' );

/**
 * wpForo skin, loaded after the plugin's own stylesheets so the overrides win.
 */
function oec_wpforo_styles() {
	if ( ! oec_wpforo_active() && ! shortcode_exists( 'wpforo' ) ) {
		return;
	}

	wp_enqueue_style( 'oec-wpforo', get_theme_file_uri( 'assets/css/wpforo.css' ), array( 'oec-theme' ), OEC_THEME_VERSION );
}
add_action( 'wp_enqueue_scripts', 'oec_wpforo_styles', 100 );

/**
 * Style the Nextend Google button on wp-login.php too, not only inside the
 * forum, so the sign in screen matches the rest of the site.
 */
function oec_login_styles() {
	wp_enqueue_style( 'oec-wpforo', get_theme_file_uri( 'assets/css/wpforo.css' ), array(), OEC_THEME_VERSION );
}
add_action( 'login_enqueue_scripts', 'oec_login_styles' );

/**
 * Set up the pages the theme expects, once, when the theme is activated.
 */
function oec_theme_after_switch() {
	oec_assign_board_template();

	if ( get_page_by_path( 'profilim' ) ) {
		return;
	}

	wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => __( 'Profilim', 'ozel-egitim-sohbet' ),
			'post_name'    => 'profilim',
			'post_author'  => get_current_user_id(),
			'post_content' => '<!-- wp:shortcode -->[wpforo item="profile"]<!-- /wp:shortcode -->',
		)
	);
}
add_action( 'after_switch_theme', 'oec_theme_after_switch' );

/**
 * Give the wpForo board page the theme's community layout, so the forum sits
 * inside the same shell (category rail on the left, guidance on the right)
 * instead of a bare content column.
 *
 * Only ever sets a template when the page has none, so a template you pick
 * by hand is never overwritten.
 */
function oec_assign_board_template() {
	$page = null;

	if ( function_exists( 'wpforo_setting' ) ) {
		$page_id = (int) wpforo_setting( 'general', 'pageid' );
		if ( $page_id ) {
			$page = get_post( $page_id );
		}
	}

	if ( ! $page ) {
		$page = get_page_by_path( 'community' );
	}

	if ( ! $page ) {
		$found = get_posts(
			array(
				'post_type'      => 'page',
				'post_status'    => 'publish',
				's'              => '[wpforo',
				'posts_per_page' => 1,
			)
		);
		$page = $found ? $found[0] : null;
	}

	if ( ! $page || 'page' !== $page->post_type ) {
		return;
	}

	if ( ! get_post_meta( $page->ID, '_wp_page_template', true ) ) {
		update_post_meta( $page->ID, '_wp_page_template', 'page-topluluk' );
	}
}

/**
 * Run the board template assignment once wpForo exists, whichever was
 * installed first — the theme or the plugin.
 */
function oec_maybe_assign_board_template() {
	if ( ! is_admin() || ! oec_wpforo_active() ) {
		return;
	}

	if ( get_option( 'oec_board_template_done' ) ) {
		return;
	}

	oec_assign_board_template();
	update_option( 'oec_board_template_done', 1, false );
}
add_action( 'admin_init', 'oec_maybe_assign_board_template' );

/**
 * Sign in URL, preferring wpForo's own login screen.
 *
 * @return string
 */
function oec_signin_url() {
	if ( function_exists( 'wpforo_login_url' ) ) {
		$url = wpforo_login_url();
		if ( $url ) {
			return $url;
		}
	}

	return wp_login_url( home_url( '/' ) );
}

/**
 * Sign up URL, preferring wpForo's own registration screen.
 *
 * @return string
 */
function oec_signup_url() {
	if ( function_exists( 'wpforo_register_url' ) ) {
		$url = wpforo_register_url();
		if ( $url ) {
			return $url;
		}
	}

	if ( get_option( 'users_can_register' ) ) {
		return wp_registration_url();
	}

	return oec_signin_url();
}

/**
 * Profile URL for the current member.
 *
 * @return string
 */
function oec_profile_url() {
	$page = get_page_by_path( 'profilim' );
	if ( $page ) {
		return (string) get_permalink( $page );
	}

	return oec_board_url( 'profile/' );
}

/**
 * Drop every cached read of the wpForo tables.
 *
 * The theme owns no copy of the forum structure, so "syncing" only means
 * throwing this cache away; the next page load reads wpForo again.
 */
function oec_flush_board_cache() {
	global $wpdb;

	delete_transient( 'oec_forum_rows' );
	delete_transient( 'oec_stats' );

	// Listing caches are keyed by their filters, so clear them by prefix.
	// Harmless no-op on installs with a persistent object cache, where the
	// short expiry does the work instead.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- targeted transient cleanup.
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( '_transient_oec_' ) . '%',
			$wpdb->esc_like( '_transient_timeout_oec_' ) . '%'
		)
	);
}

/**
 * Keep the theme in step with wpForo.
 *
 * Adding, editing, reordering or deleting a category or forum in wpForo, and
 * every new topic or reply, invalidates the theme's cache straight away.
 * wpForo has renamed some of these actions across versions, so the list is
 * deliberately generous — an action that does not exist simply never fires,
 * and the short cache lifetime covers anything the hooks miss.
 */
function oec_register_sync_hooks() {
	$hooks = array(
		// Categories and forums.
		'wpforo_after_add_forum',
		'wpforo_after_edit_forum',
		'wpforo_after_delete_forum',
		'wpforo_after_forum_add',
		'wpforo_after_forum_edit',
		'wpforo_after_forum_delete',
		'wpforo_after_save_forum',
		'wpforo_forum_rebuild',
		'wpforo_after_rebuild_forums',
		'wpforo_reset_forums_cache',
		// Topics and posts, which move the counters.
		'wpforo_after_add_topic',
		'wpforo_after_edit_topic',
		'wpforo_after_delete_topic',
		'wpforo_after_move_topic',
		'wpforo_after_add_post',
		'wpforo_after_edit_post',
		'wpforo_after_delete_post',
		'wpforo_after_approve_topic',
		'wpforo_after_approve_post',
	);

	foreach ( $hooks as $hook ) {
		add_action( $hook, 'oec_flush_board_cache', 20 );
	}
}
add_action( 'init', 'oec_register_sync_hooks', 5 );

/**
 * An administrator who just saved something on a wpForo admin screen should
 * see the change on the site immediately, whichever hook wpForo fired.
 */
function oec_flush_cache_in_wpforo_admin() {
	if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- reading the admin screen name only.
	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

	if ( 0 === strpos( $page, 'wpforo' ) ) {
		oec_flush_board_cache();
	}
}
add_action( 'admin_init', 'oec_flush_cache_in_wpforo_admin' );

/**
 * The community board needs the full width of the shell, so opt the wpForo
 * page out of the constrained content width.
 *
 * @param array $classes Body classes.
 * @return array
 */
function oec_body_class( $classes ) {
	if ( function_exists( 'is_wpforo_page' ) && is_wpforo_page() ) {
		$classes[] = 'oec-board-page';
	}

	return $classes;
}
add_filter( 'body_class', 'oec_body_class' );
