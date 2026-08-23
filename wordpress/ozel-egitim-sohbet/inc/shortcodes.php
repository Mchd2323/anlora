<?php
/**
 * Theme shortcodes.
 *
 * These render the community surfaces of the front page (account widget,
 * topic rail, discussion list, board stats) from live wpForo data, and fall
 * back to a helpful placeholder when wpForo is not installed yet.
 *
 * @package OzelEgitimSohbet
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register every shortcode the templates rely on.
 */
function oec_register_shortcodes() {
	add_shortcode( 'oec_account', 'oec_shortcode_account' );
	add_shortcode( 'oec_privacy_warning', 'oec_shortcode_privacy_warning' );
	add_shortcode( 'oec_topics', 'oec_shortcode_topics' );
	add_shortcode( 'oec_stats', 'oec_shortcode_stats' );
	add_shortcode( 'oec_discussions', 'oec_shortcode_discussions' );
	add_shortcode( 'oec_ask_button', 'oec_shortcode_ask_button' );

	// Keep [wpforo] from printing raw text while the plugin is missing.
	if ( ! shortcode_exists( 'wpforo' ) ) {
		add_shortcode( 'wpforo', 'oec_shortcode_wpforo_missing' );
	}
}
add_action( 'init', 'oec_register_shortcodes', 99 );

/**
 * Header account widget: sign in / sign up when logged out, avatar, name,
 * member group and sign out when logged in.
 *
 * @return string
 */
function oec_shortcode_account() {
	if ( ! is_user_logged_in() ) {
		$html  = '<div class="oec-account oec-account--guest">';
		$html .= '<a class="oec-account-link" href="' . esc_url( oec_signin_url() ) . '">' . esc_html__( 'Giriş', 'ozel-egitim-sohbet' ) . '</a>';
		$html .= '<a class="oec-account-cta" href="' . esc_url( oec_signup_url() ) . '">' . esc_html__( 'Üye ol', 'ozel-egitim-sohbet' ) . '</a>';
		$html .= '</div>';

		return $html;
	}

	$user    = wp_get_current_user();
	$name    = $user->display_name ? $user->display_name : $user->user_login;
	$group   = oec_member_group( $user->ID );
	$initial = oec_initial( $name );

	$html  = '<div class="oec-account">';
	$html .= '<a class="oec-account-user" href="' . esc_url( oec_profile_url() ) . '">';
	$html .= '<span class="oec-account-avatar" aria-hidden="true">' . esc_html( $initial ) . '</span>';
	$html .= '<span class="oec-account-meta"><b>' . esc_html( $name ) . '</b>';
	if ( $group ) {
		$html .= '<i>' . esc_html( $group ) . '</i>';
	}
	$html .= '</span></a>';
	$html .= '<a class="oec-account-link" href="' . esc_url( wp_logout_url( home_url( '/' ) ) ) . '">' . esc_html__( 'Çıkış', 'ozel-egitim-sohbet' ) . '</a>';
	$html .= '</div>';

	return $html;
}

/**
 * Standing privacy reminder.
 *
 * @return string
 */
function oec_shortcode_privacy_warning() {
	$html  = '<div class="oec-privacy" role="note">';
	$html .= '<span class="oec-privacy-icon" aria-hidden="true">' . oec_icon( 'shield' ) . '</span>';
	$html .= '<div><strong>' . esc_html__( 'Çocukların mahremiyetini birlikte koruyalım', 'ozel-egitim-sohbet' ) . '</strong>';
	$html .= '<p>' . esc_html__( 'Çocuğun adını, okulunu, fotoğrafını, rapor numarasını veya onu tanınabilir kılacak hiçbir bilgiyi paylaşmayın.', 'ozel-egitim-sohbet' ) . '</p>';
	$html .= '</div></div>';

	return $html;
}

/**
 * Category rail, rendered straight from the wpForo forum tree.
 *
 * The theme keeps no forum list of its own: categories, forums, their order
 * and their topic counts all come from wpForo, so adding, renaming,
 * reordering or deleting a forum there changes this rail too.
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function oec_shortcode_topics( $atts = array() ) {
	$atts = shortcode_atts(
		array(
			'limit'      => 0,
			'show_empty' => 'yes',
		),
		$atts,
		'oec_topics'
	);

	$tree    = oec_get_forum_tree();
	$current = isset( $_GET['forum'] ) ? (int) $_GET['forum'] : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only listing filter.
	$hide    = ( 'no' === $atts['show_empty'] );
	$limit   = (int) $atts['limit'];

	if ( ! $tree ) {
		return oec_forum_rail_placeholder();
	}

	$html  = '<nav class="oec-forum-nav" aria-label="' . esc_attr__( 'Forum kategorileri', 'ozel-egitim-sohbet' ) . '">';
	$html .= oec_forum_rail_item(
		array(
			'label'  => __( 'Tümü', 'ozel-egitim-sohbet' ),
			'count'  => oec_get_forum_topic_total(),
			'url'    => oec_topics_filter_url( array( 'forum' => 0 ) ),
			'active' => ( 0 === $current ),
			'class'  => 'oec-forum-item--all',
		)
	);

	$shown = 0;
	foreach ( $tree as $group ) {
		$items = '';

		foreach ( $group['forums'] as $forum ) {
			if ( $hide && $forum['topics'] < 1 ) {
				continue;
			}
			if ( $limit > 0 && $shown >= $limit ) {
				break 2;
			}

			$items .= oec_forum_rail_item(
				array(
					'label'  => $forum['title'],
					'count'  => $forum['topics'],
					'url'    => oec_topics_filter_url( array( 'forum' => $forum['forumid'] ) ),
					'active' => ( $current === $forum['forumid'] ),
				)
			);
			$shown++;
		}

		if ( '' === $items ) {
			continue;
		}

		$html .= '<div class="oec-forum-group">';
		if ( $group['title'] ) {
			$html .= '<p class="oec-forum-cat"><a href="' . esc_url( oec_forum_url( $group ) ) . '">' . esc_html( $group['title'] ) . '</a></p>';
		}
		$html .= $items;
		$html .= '</div>';
	}

	$html .= '</nav>';
	$html .= oec_forum_rail_admin_link();

	return $html;
}

/**
 * One rail row.
 *
 * @param array $args label, count, url, active, class.
 * @return string
 */
function oec_forum_rail_item( $args ) {
	$class = 'oec-forum-item';
	if ( ! empty( $args['class'] ) ) {
		$class .= ' ' . $args['class'];
	}
	if ( ! empty( $args['active'] ) ) {
		$class .= ' is-active';
	}

	$html  = '<a class="' . esc_attr( $class ) . '" href="' . esc_url( $args['url'] ) . '"';
	$html .= ! empty( $args['active'] ) ? ' aria-current="true"' : '';
	$html .= '><span>' . esc_html( $args['label'] ) . '</span>';
	$html .= '<b>' . esc_html( number_format_i18n( (int) $args['count'] ) ) . '</b></a>';

	return $html;
}

/**
 * Rail fallback when wpForo has no forums yet.
 *
 * @return string
 */
function oec_forum_rail_placeholder() {
	$html  = '<nav class="oec-forum-nav" aria-label="' . esc_attr__( 'Forum kategorileri', 'ozel-egitim-sohbet' ) . '">';
	$html .= '<a class="oec-forum-item" href="' . esc_url( oec_board_url() ) . '"><span>' . esc_html__( 'Tüm sorular', 'ozel-egitim-sohbet' ) . '</span><b aria-hidden="true">&rarr;</b></a>';
	$html .= '</nav>';

	if ( current_user_can( 'manage_options' ) ) {
		$html .= '<p class="oec-hint">' . esc_html__( 'Bu liste doğrudan wpForo forumlarından gelir. Henüz forum yok.', 'ozel-egitim-sohbet' ) . '</p>';
		$html .= oec_forum_rail_admin_link( __( 'Forum ekle', 'ozel-egitim-sohbet' ) );
	}

	return $html;
}

/**
 * Link that takes an administrator from the rail to the wpForo screen where
 * these categories are actually managed.
 *
 * @param string $label Optional link label.
 * @return string
 */
function oec_forum_rail_admin_link( $label = '' ) {
	if ( ! current_user_can( 'manage_options' ) || ! oec_wpforo_active() ) {
		return '';
	}

	$label = $label ? $label : __( 'Kategorileri düzenle', 'ozel-egitim-sohbet' );

	return '<p class="oec-forum-admin"><a href="' . esc_url( admin_url( 'admin.php?page=wpforo-forums' ) ) . '">' . esc_html( $label ) . ' &rarr;</a></p>';
}

/**
 * Board totals card.
 *
 * @return string
 */
function oec_shortcode_stats() {
	// Rendered even before wpForo exists: the counters simply read zero, so
	// the card never shows up as an empty box under its heading.
	$stats = oec_get_stats();

	$rows = array(
		array( $stats['topics'], _n( 'açık konuşma', 'açık konuşma', $stats['topics'], 'ozel-egitim-sohbet' ) ),
		array( $stats['answers'], _n( 'paylaşılan yanıt', 'paylaşılan yanıt', $stats['answers'], 'ozel-egitim-sohbet' ) ),
		array( $stats['members'], _n( 'topluluk üyesi', 'topluluk üyesi', $stats['members'], 'ozel-egitim-sohbet' ) ),
	);

	$html = '<ul class="oec-stat-list">';
	foreach ( $rows as $row ) {
		$html .= '<li><b>' . esc_html( number_format_i18n( $row[0] ) ) . '</b><span>' . esc_html( $row[1] ) . '</span></li>';
	}
	$html .= '</ul>';

	return $html;
}

/**
 * "+ Soru sor" button pointing at the wpForo new topic screen.
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function oec_shortcode_ask_button( $atts = array() ) {
	$atts = shortcode_atts(
		array(
			'label' => __( '+ Soru sor', 'ozel-egitim-sohbet' ),
			'class' => '',
		),
		$atts,
		'oec_ask_button'
	);

	$class = trim( 'oec-btn ' . $atts['class'] );

	return '<a class="' . esc_attr( $class ) . '" href="' . esc_url( oec_ask_url() ) . '">' . esc_html( $atts['label'] ) . '</a>';
}

/**
 * Front page discussion list: search field, sort control and topic cards.
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function oec_shortcode_discussions( $atts = array() ) {
	$atts = shortcode_atts(
		array(
			'limit' => 6,
		),
		$atts,
		'oec_discussions'
	);

	// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only listing filters.
	$search = isset( $_GET['soru'] ) ? sanitize_text_field( wp_unslash( $_GET['soru'] ) ) : '';
	$forum  = isset( $_GET['forum'] ) ? (int) $_GET['forum'] : 0;
	$order  = isset( $_GET['sira'] ) ? sanitize_key( wp_unslash( $_GET['sira'] ) ) : 'recent';
	// phpcs:enable WordPress.Security.NonceVerification.Recommended

	if ( ! in_array( $order, array( 'recent', 'answers', 'views' ), true ) ) {
		$order = 'recent';
	}

	$html = '<div class="oec-discussions" id="konusmalar">';

	if ( ! oec_wpforo_table( 'topics' ) ) {
		// No board yet: a search box over nothing would only be noise.
		$html .= oec_shortcode_wpforo_missing();
		$html .= '</div>';

		return $html;
	}

	$html .= oec_discussions_toolbar( $search, $order, $forum );

	$topics = oec_get_topics(
		array(
			'limit'  => (int) $atts['limit'],
			'order'  => $order,
			'search' => $search,
			'forum'  => $forum,
		)
	);

	$count = count( $topics );

	$html .= '<p class="oec-result-count">';
	if ( '' !== $search ) {
		/* translators: 1: number of conversations, 2: search term. */
		$html .= esc_html( sprintf( _n( '“%2$s” için %1$s konuşma bulundu', '“%2$s” için %1$s konuşma bulundu', $count, 'ozel-egitim-sohbet' ), number_format_i18n( $count ), $search ) );
	} else {
		/* translators: %s: number of conversations. */
		$html .= esc_html( sprintf( _n( '%s konuşma gösteriliyor', '%s konuşma gösteriliyor', $count, 'ozel-egitim-sohbet' ), number_format_i18n( $count ) ) );
	}
	$html .= '</p>';

	if ( ! $topics ) {
		$html .= '<div class="oec-empty-forum">';
		if ( '' !== $search ) {
			$html .= '<strong>' . esc_html__( 'Bu aramaya uygun bir konuşma yok.', 'ozel-egitim-sohbet' ) . '</strong>';
			$html .= '<p>' . esc_html__( 'Farklı bir anahtar kelime deneyin veya sorunuzu siz sorun.', 'ozel-egitim-sohbet' ) . '</p>';
		} else {
			$html .= '<strong>' . esc_html__( 'Henüz paylaşılan bir konuşma yok.', 'ozel-egitim-sohbet' ) . '</strong>';
			$html .= '<p>' . esc_html__( 'İlk soruyu siz sorarak topluluğu başlatın.', 'ozel-egitim-sohbet' ) . '</p>';
		}
		$html .= '<a href="' . esc_url( oec_ask_url() ) . '">' . esc_html__( 'Soru sor', 'ozel-egitim-sohbet' ) . '</a>';
		$html .= '</div></div>';

		return $html;
	}

	$html .= '<div class="oec-thread-list">';
	foreach ( $topics as $topic ) {
		$html .= oec_render_thread_card( $topic );
	}
	$html .= '</div>';

	$html .= '<p class="oec-discussions-more"><a href="' . esc_url( oec_board_url() ) . '">' . esc_html__( 'Tüm konuşmaları gör', 'ozel-egitim-sohbet' ) . ' &rarr;</a></p>';
	$html .= '</div>';

	return $html;
}

/**
 * Search and sort controls above the discussion list.
 *
 * @param string $search Current search term.
 * @param string $order  Current sort key.
 * @param int    $forum  Current forum filter.
 * @return string
 */
function oec_discussions_toolbar( $search, $order, $forum ) {
	$orders = array(
		'recent'  => __( 'En yeni', 'ozel-egitim-sohbet' ),
		'answers' => __( 'En çok yanıtlanan', 'ozel-egitim-sohbet' ),
		'views'   => __( 'En çok okunan', 'ozel-egitim-sohbet' ),
	);

	$action = oec_topics_filter_url( array(), true );

	$html  = '<form class="oec-toolbar" method="get" action="' . esc_url( $action ) . '" role="search">';
	$html .= '<label class="oec-search">';
	$html .= '<span class="screen-reader-text">' . esc_html__( 'Konuşmalarda ara', 'ozel-egitim-sohbet' ) . '</span>';
	$html .= '<span class="oec-search-icon" aria-hidden="true">' . oec_icon( 'search' ) . '</span>';
	$html .= '<input type="search" name="soru" value="' . esc_attr( $search ) . '" placeholder="' . esc_attr__( 'Bir sorun veya anahtar kelime ara…', 'ozel-egitim-sohbet' ) . '">';
	$html .= '</label>';

	$html .= '<label class="oec-sort"><span class="screen-reader-text">' . esc_html__( 'Sıralama', 'ozel-egitim-sohbet' ) . '</span>';
	$html .= '<select name="sira" data-oec-autosubmit>';
	foreach ( $orders as $key => $label ) {
		$html .= '<option value="' . esc_attr( $key ) . '"' . selected( $order, $key, false ) . '>' . esc_html( $label ) . '</option>';
	}
	$html .= '</select></label>';

	if ( $forum > 0 ) {
		$html .= '<input type="hidden" name="forum" value="' . esc_attr( (string) $forum ) . '">';
	}

	$html .= '<button type="submit" class="oec-toolbar-submit">' . esc_html__( 'Ara', 'ozel-egitim-sohbet' ) . '</button>';
	$html .= '</form>';

	return $html;
}

/**
 * One discussion card.
 *
 * @param array $topic Topic row from oec_get_topics().
 * @return string
 */
function oec_render_thread_card( $topic ) {
	$name  = oec_member_name( $topic['userid'] );
	$group = oec_member_group( $topic['userid'] );
	$date  = oec_relative_date( $topic['created'] );
	$url   = oec_topic_url( $topic );

	$excerpt = wp_strip_all_tags( (string) $topic['excerpt'] );
	$excerpt = wp_trim_words( $excerpt, 34, '…' );

	$html  = '<article class="oec-thread">';
	$html .= '<span class="oec-thread-avatar" aria-hidden="true">' . esc_html( oec_initial( $name ) ) . '</span>';
	$html .= '<div class="oec-thread-body">';

	$html .= '<p class="oec-thread-meta"><b>' . esc_html( $name ) . '</b>';
	if ( $group ) {
		$html .= '<span class="oec-badge">' . esc_html( $group ) . '</span>';
	}
	if ( $date ) {
		$html .= '<span aria-hidden="true">•</span><span>' . esc_html( $date ) . '</span>';
	}
	$html .= '</p>';

	$html .= '<h3 class="oec-thread-title"><a href="' . esc_url( $url ) . '">' . esc_html( $topic['title'] ) . '</a></h3>';

	if ( $excerpt ) {
		$html .= '<p class="oec-thread-excerpt">' . esc_html( $excerpt ) . '</p>';
	}

	if ( $topic['forum_title'] || $topic['solved'] ) {
		$html .= '<p class="oec-thread-tags">';
		if ( $topic['forum_title'] ) {
			$html .= '<a class="oec-tag" href="' . esc_url( oec_forum_url( array( 'slug' => $topic['forum_slug'] ) ) ) . '">' . esc_html( $topic['forum_title'] ) . '</a>';
		}
		if ( $topic['solved'] ) {
			$html .= '<span class="oec-tag oec-tag--solved">' . esc_html__( 'Çözüldü', 'ozel-egitim-sohbet' ) . '</span>';
		}
		$html .= '</p>';
	}

	$html .= '<div class="oec-thread-foot">';
	if ( $topic['votes'] > 0 ) {
		/* translators: %s: number of helpful votes. */
		$html .= '<span class="oec-thread-stat">' . oec_icon( 'heart' ) . esc_html( sprintf( _n( '%s yararlı', '%s yararlı', $topic['votes'], 'ozel-egitim-sohbet' ), number_format_i18n( $topic['votes'] ) ) ) . '</span>';
	}
	/* translators: %s: number of replies. */
	$html .= '<span class="oec-thread-stat">' . oec_icon( 'reply' ) . esc_html( sprintf( _n( '%s yanıt', '%s yanıt', $topic['answers'], 'ozel-egitim-sohbet' ), number_format_i18n( $topic['answers'] ) ) ) . '</span>';
	$html .= '<a class="oec-thread-open" href="' . esc_url( $url ) . '">' . esc_html__( 'Konuşmayı aç', 'ozel-egitim-sohbet' ) . ' &rarr;</a>';
	$html .= '</div>';

	$html .= '</div></article>';

	return $html;
}

/**
 * Placeholder shown where the board would be while wpForo is missing.
 *
 * @return string
 */
function oec_shortcode_wpforo_missing() {
	if ( current_user_can( 'install_plugins' ) ) {
		return '<div class="oec-empty-forum"><strong>' . esc_html__( 'Topluluk alanı için wpForo gerekiyor.', 'ozel-egitim-sohbet' ) . '</strong>'
			. '<p>' . esc_html__( 'Yönetim panelinden wpForo Forum eklentisini kurup etkinleştirin.', 'ozel-egitim-sohbet' ) . '</p>'
			. '<a href="' . esc_url( admin_url( 'themes.php?page=oec-theme-setup' ) ) . '">' . esc_html__( 'Tema Kurulumu sayfasını açın', 'ozel-egitim-sohbet' ) . '</a></div>';
	}

	return '<div class="oec-empty-forum"><strong>' . esc_html__( 'Topluluk alanı hazırlanıyor.', 'ozel-egitim-sohbet' ) . '</strong>'
		. '<p>' . esc_html__( 'Sorular ve yanıtlar çok yakında burada olacak.', 'ozel-egitim-sohbet' ) . '</p></div>';
}

/**
 * Build a front page URL carrying the current listing filters.
 *
 * @param array $args      Query args to set (a falsy value removes the arg).
 * @param bool  $base_only Return the bare page URL, for form actions.
 * @return string
 */
function oec_topics_filter_url( $args = array(), $base_only = false ) {
	$base = home_url( '/' );

	if ( ! is_front_page() ) {
		$queried = get_queried_object_id();
		if ( $queried && get_permalink( $queried ) ) {
			$base = get_permalink( $queried );
		}
	}

	if ( $base_only ) {
		return $base;
	}

	// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only listing filters.
	$current = array(
		'soru'  => isset( $_GET['soru'] ) ? sanitize_text_field( wp_unslash( $_GET['soru'] ) ) : '',
		'sira'  => isset( $_GET['sira'] ) ? sanitize_key( wp_unslash( $_GET['sira'] ) ) : '',
		'forum' => isset( $_GET['forum'] ) ? (int) $_GET['forum'] : 0,
	);
	// phpcs:enable WordPress.Security.NonceVerification.Recommended

	$merged = array_merge( $current, $args );
	$query  = array();
	foreach ( $merged as $key => $value ) {
		if ( '' !== $value && 0 !== $value && '0' !== $value ) {
			$query[ $key ] = $value;
		}
	}

	$url = $query ? add_query_arg( $query, $base ) : $base;

	return $url . '#konusmalar';
}

/**
 * Uppercase first letter of a name, multibyte safe for Turkish characters.
 *
 * @param string $name Display name.
 * @return string
 */
function oec_initial( $name ) {
	$name = trim( (string) $name );
	if ( '' === $name ) {
		return '•';
	}

	if ( function_exists( 'mb_substr' ) ) {
		return mb_strtoupper( mb_substr( $name, 0, 1, 'UTF-8' ), 'UTF-8' );
	}

	return strtoupper( substr( $name, 0, 1 ) );
}

/**
 * Inline SVG icons, so the theme needs no icon font or external request.
 *
 * @param string $name Icon key.
 * @return string
 */
function oec_icon( $name ) {
	$icons = array(
		'shield'  => '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
		'search'  => '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
		'heart'   => '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z"/>',
		'reply'   => '<path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.3A8 8 0 1 1 21 12z"/>',
		'sparkle' => '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
	);

	if ( ! isset( $icons[ $name ] ) ) {
		return '';
	}

	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $icons[ $name ] . '</svg>';
}
