<?php
/**
 * Read-only wpForo data layer.
 *
 * Every function here degrades gracefully: when wpForo is missing, when its
 * tables have not been created yet, or when a column this theme expects does
 * not exist in the installed wpForo version, the callers get an empty array
 * instead of a fatal error or an SQL warning.
 *
 * @package OzelEgitimSohbet
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether wpForo is active.
 *
 * @return bool
 */
function oec_wpforo_active() {
	return ( defined( 'WPFORO_VERSION' ) || function_exists( 'WPF' ) );
}

/**
 * Resolve a wpForo table name, returning '' when the table does not exist.
 *
 * Only names from a fixed whitelist are accepted, so the returned value is
 * always safe to interpolate into a query.
 *
 * @param string $name Table suffix, e.g. 'topics'.
 * @return string Full table name or empty string.
 */
function oec_wpforo_table( $name ) {
	global $wpdb;

	$allowed = array( 'forums', 'topics', 'posts', 'profiles', 'usergroups', 'likes' );
	if ( ! in_array( $name, $allowed, true ) ) {
		return '';
	}

	static $cache = array();
	if ( isset( $cache[ $name ] ) ) {
		return $cache[ $name ];
	}

	$table = $wpdb->prefix . 'wpforo_' . $name;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- schema probe, cached per request.
	$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );

	$cache[ $name ] = ( $found === $table ) ? $table : '';

	return $cache[ $name ];
}

/**
 * Column map for a wpForo table, so optional filters can be applied only when
 * the installed wpForo version actually has the column.
 *
 * @param string $name Table suffix.
 * @return array Column name => true.
 */
function oec_wpforo_columns( $name ) {
	global $wpdb;

	static $cache = array();
	if ( isset( $cache[ $name ] ) ) {
		return $cache[ $name ];
	}

	$table = oec_wpforo_table( $name );
	if ( ! $table ) {
		$cache[ $name ] = array();
		return $cache[ $name ];
	}

	// phpcs:ignore WordPress.DB.PreparedSQL -- $table comes from the whitelist above.
	$columns = $wpdb->get_col( "SHOW COLUMNS FROM `{$table}`" );

	$cache[ $name ] = is_array( $columns ) ? array_fill_keys( $columns, true ) : array();

	return $cache[ $name ];
}

/**
 * Whether a wpForo table has a given column.
 *
 * @param string $name   Table suffix.
 * @param string $column Column name.
 * @return bool
 */
function oec_wpforo_has_column( $name, $column ) {
	$columns = oec_wpforo_columns( $name );
	return isset( $columns[ $column ] );
}

/**
 * Board base URL, with a fallback for installs where wpForo is not loaded.
 *
 * @param string $path Optional path appended to the board URL.
 * @return string
 */
function oec_board_url( $path = '' ) {
	$path = ltrim( (string) $path, '/' );

	if ( function_exists( 'wpforo_home_url' ) ) {
		return wpforo_home_url( $path );
	}

	return home_url( '/community/' . $path );
}

/**
 * Permalink for a topic row.
 *
 * @param array $topic Topic row.
 * @return string
 */
function oec_topic_url( $topic ) {
	$forum_slug = isset( $topic['forum_slug'] ) ? (string) $topic['forum_slug'] : '';
	$topic_slug = isset( $topic['slug'] ) ? (string) $topic['slug'] : '';

	if ( $forum_slug && $topic_slug ) {
		return oec_board_url( $forum_slug . '/' . $topic_slug . '/' );
	}

	return oec_board_url();
}

/**
 * Permalink for a forum row.
 *
 * @param array $forum Forum row.
 * @return string
 */
function oec_forum_url( $forum ) {
	$slug = isset( $forum['slug'] ) ? (string) $forum['slug'] : '';

	return $slug ? oec_board_url( $slug . '/' ) : oec_board_url();
}

/**
 * URL of the "ask a question" screen.
 *
 * @return string
 */
function oec_ask_url() {
	if ( ! oec_wpforo_active() ) {
		return oec_board_url();
	}

	return oec_board_url( 'add-topic/' );
}

/**
 * Public (non-private) forum IDs, used to keep private forums out of the
 * front page listing.
 *
 * @return array List of forum IDs, or an empty array when unknown.
 */
function oec_public_forum_ids() {
	global $wpdb;

	static $ids = null;
	if ( null !== $ids ) {
		return $ids;
	}

	$forums = oec_wpforo_table( 'forums' );
	if ( ! $forums || ! oec_wpforo_has_column( 'forums', 'private' ) ) {
		$ids = array();
		return $ids;
	}

	// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted table name.
	$rows = $wpdb->get_col( "SELECT forumid FROM `{$forums}` WHERE private = 0" );

	$ids = is_array( $rows ) ? array_map( 'intval', $rows ) : array();

	return $ids;
}

/**
 * Forum and category list with topic counts.
 *
 * @param int $limit Maximum number of forums returned.
 * @return array
 */
function oec_get_forums( $limit = 8 ) {
	global $wpdb;

	$table = oec_wpforo_table( 'forums' );
	if ( ! $table ) {
		return array();
	}

	$limit = max( 1, (int) $limit );
	$cache = 'oec_forums_' . $limit;
	$rows  = get_transient( $cache );

	if ( false === $rows ) {
		$where = array();
		if ( oec_wpforo_has_column( 'forums', 'private' ) ) {
			$where[] = 'private = 0';
		}
		if ( oec_wpforo_has_column( 'forums', 'status' ) ) {
			$where[] = 'status = 0';
		}
		$where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';

		$order = oec_wpforo_has_column( 'forums', 'orderid' ) ? 'orderid ASC, forumid ASC' : 'forumid ASC';

		// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted table, generated clauses.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM `{$table}` {$where_sql} ORDER BY {$order} LIMIT %d", $limit ), ARRAY_A );
		$rows = is_array( $rows ) ? $rows : array();

		set_transient( $cache, $rows, 5 * MINUTE_IN_SECONDS );
	}

	$forums = array();
	foreach ( $rows as $row ) {
		// Categories are containers in wpForo; only forums hold topics.
		if ( isset( $row['is_cat'] ) && (int) $row['is_cat'] === 1 ) {
			continue;
		}

		$forums[] = array(
			'forumid' => isset( $row['forumid'] ) ? (int) $row['forumid'] : 0,
			'title'   => isset( $row['title'] ) ? (string) $row['title'] : '',
			'slug'    => isset( $row['slug'] ) ? (string) $row['slug'] : '',
			'topics'  => isset( $row['topics'] ) ? (int) $row['topics'] : 0,
		);
	}

	return $forums;
}

/**
 * Recent topics for the front page listing.
 *
 * @param array $args {
 *     @type int    $limit  Number of topics.
 *     @type string $order  'recent' or 'answers'.
 *     @type string $search Free text matched against the topic title.
 *     @type int    $forum  Restrict to a forum ID.
 * }
 * @return array
 */
function oec_get_topics( $args = array() ) {
	global $wpdb;

	$args = wp_parse_args(
		$args,
		array(
			'limit'  => 6,
			'order'  => 'recent',
			'search' => '',
			'forum'  => 0,
		)
	);

	$topics_table = oec_wpforo_table( 'topics' );
	$posts_table  = oec_wpforo_table( 'posts' );
	$forums_table = oec_wpforo_table( 'forums' );

	if ( ! $topics_table ) {
		return array();
	}

	$limit  = max( 1, min( 30, (int) $args['limit'] ) );
	$search = trim( (string) $args['search'] );
	$forum  = (int) $args['forum'];

	$cache_key = 'oec_topics_' . md5( wp_json_encode( array( $limit, $args['order'], $search, $forum ) ) );
	$cached    = get_transient( $cache_key );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$select = array( 't.*' );
	$join   = '';

	if ( $posts_table && oec_wpforo_has_column( 'topics', 'first_postid' ) ) {
		$select[] = 'p.body AS oec_body';
		$join    .= " LEFT JOIN `{$posts_table}` p ON p.postid = t.first_postid";
	}
	if ( $forums_table ) {
		$select[] = 'f.slug AS forum_slug';
		$select[] = 'f.title AS forum_title';
		$join    .= " LEFT JOIN `{$forums_table}` f ON f.forumid = t.forumid";
	}

	$where  = array( '1=1' );
	$params = array();

	if ( oec_wpforo_has_column( 'topics', 'private' ) ) {
		$where[] = 't.private = 0';
	}
	if ( $forum > 0 ) {
		$where[]  = 't.forumid = %d';
		$params[] = $forum;
	} else {
		$public = oec_public_forum_ids();
		if ( $public ) {
			$where[] = 't.forumid IN (' . implode( ',', array_map( 'intval', $public ) ) . ')';
		}
	}
	if ( '' !== $search ) {
		$where[]  = 't.title LIKE %s';
		$params[] = '%' . $wpdb->esc_like( $search ) . '%';
	}

	if ( 'answers' === $args['order'] && oec_wpforo_has_column( 'topics', 'posts' ) ) {
		$order_sql = 't.posts DESC, t.topicid DESC';
	} elseif ( 'views' === $args['order'] && oec_wpforo_has_column( 'topics', 'views' ) ) {
		$order_sql = 't.views DESC, t.topicid DESC';
	} elseif ( oec_wpforo_has_column( 'topics', 'created' ) ) {
		$order_sql = 't.created DESC, t.topicid DESC';
	} else {
		$order_sql = 't.topicid DESC';
	}

	$select_sql = implode( ', ', $select );
	$rows       = array();

	// Unapproved topics carry status = 1 in wpForo. Filter them out when the
	// column exists, but retry unfiltered if that yields nothing while topics
	// do exist, so an unexpected status scheme never empties the front page.
	$status_variants = oec_wpforo_has_column( 'topics', 'status' )
		? array( ' AND t.status = 0', '' )
		: array( '' );

	foreach ( $status_variants as $status_sql ) {
		$where_sql = implode( ' AND ', $where ) . $status_sql;
		// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted tables, generated clauses, values bound below.
		$sql  = "SELECT {$select_sql} FROM `{$topics_table}` t{$join} WHERE {$where_sql} ORDER BY {$order_sql} LIMIT %d";
		$bind = array_merge( $params, array( $limit ) );
		// phpcs:ignore WordPress.DB.PreparedSQL
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $bind ), ARRAY_A );
		$rows = is_array( $rows ) ? $rows : array();

		if ( $rows ) {
			break;
		}
	}

	$topics = array();
	foreach ( $rows as $row ) {
		$posts   = isset( $row['posts'] ) ? (int) $row['posts'] : 0;
		$answers = isset( $row['answers'] ) ? (int) $row['answers'] : max( 0, $posts - 1 );

		$topics[] = array(
			'topicid'     => isset( $row['topicid'] ) ? (int) $row['topicid'] : 0,
			'title'       => isset( $row['title'] ) ? (string) $row['title'] : '',
			'slug'        => isset( $row['slug'] ) ? (string) $row['slug'] : '',
			'userid'      => isset( $row['userid'] ) ? (int) $row['userid'] : 0,
			'created'     => isset( $row['created'] ) ? (string) $row['created'] : '',
			'answers'     => $answers,
			'views'       => isset( $row['views'] ) ? (int) $row['views'] : 0,
			'likes'       => isset( $row['likes'] ) ? (int) $row['likes'] : 0,
			'excerpt'     => isset( $row['oec_body'] ) ? (string) $row['oec_body'] : '',
			'forumid'     => isset( $row['forumid'] ) ? (int) $row['forumid'] : 0,
			'forum_slug'  => isset( $row['forum_slug'] ) ? (string) $row['forum_slug'] : '',
			'forum_title' => isset( $row['forum_title'] ) ? (string) $row['forum_title'] : '',
			'solved'      => ! empty( $row['solved'] ),
		);
	}

	set_transient( $cache_key, $topics, MINUTE_IN_SECONDS );

	return $topics;
}

/**
 * Board totals used by the "today in the community" card.
 *
 * @return array {
 *     @type int $topics  Open conversations.
 *     @type int $answers Shared answers.
 *     @type int $members Registered members.
 * }
 */
function oec_get_stats() {
	global $wpdb;

	$cached = get_transient( 'oec_stats' );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$stats = array(
		'topics'  => 0,
		'answers' => 0,
		'members' => 0,
	);

	$topics_table = oec_wpforo_table( 'topics' );
	$posts_table  = oec_wpforo_table( 'posts' );

	if ( $topics_table ) {
		$where = oec_wpforo_has_column( 'topics', 'private' ) ? 'WHERE private = 0' : '';
		// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted table.
		$stats['topics'] = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$topics_table}` {$where}" );
	}

	if ( $posts_table && oec_wpforo_has_column( 'posts', 'is_first_post' ) ) {
		// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted table.
		$stats['answers'] = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$posts_table}` WHERE is_first_post = 0" );
	} elseif ( $posts_table ) {
		// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted table.
		$total            = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$posts_table}`" );
		$stats['answers'] = max( 0, $total - $stats['topics'] );
	}

	$counts            = count_users();
	$stats['members'] = isset( $counts['total_users'] ) ? (int) $counts['total_users'] : 0;

	set_transient( 'oec_stats', $stats, 5 * MINUTE_IN_SECONDS );

	return $stats;
}

/**
 * Human readable member group for a user: the wpForo user group when
 * available, otherwise the WordPress role.
 *
 * @param int $user_id User ID.
 * @return string
 */
function oec_member_group( $user_id ) {
	global $wpdb;

	$user_id = (int) $user_id;
	if ( $user_id < 1 ) {
		return '';
	}

	static $cache = array();
	if ( isset( $cache[ $user_id ] ) ) {
		return $cache[ $user_id ];
	}

	$label     = '';
	$profiles  = oec_wpforo_table( 'profiles' );
	$usergroup = oec_wpforo_table( 'usergroups' );

	if ( $profiles && $usergroup ) {
		// phpcs:ignore WordPress.DB.PreparedSQL -- whitelisted tables.
		$label = (string) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT g.name FROM `{$profiles}` pr INNER JOIN `{$usergroup}` g ON g.groupid = pr.groupid WHERE pr.userid = %d LIMIT 1",
				$user_id
			)
		);
	}

	if ( '' === $label ) {
		$user = get_userdata( $user_id );
		if ( $user && ! empty( $user->roles ) ) {
			$roles = wp_roles()->get_names();
			$role  = reset( $user->roles );
			if ( isset( $roles[ $role ] ) ) {
				$label = translate_user_role( $roles[ $role ] );
			}
		}
	}

	$cache[ $user_id ] = $label;

	return $label;
}

/**
 * Display name for a topic author, falling back to a neutral label for
 * deleted or guest accounts.
 *
 * @param int $user_id User ID.
 * @return string
 */
function oec_member_name( $user_id ) {
	$user = get_userdata( (int) $user_id );

	if ( $user && $user->display_name ) {
		return $user->display_name;
	}

	return __( 'Topluluk üyesi', 'ozel-egitim-sohbet' );
}

/**
 * Relative date label: "Bugün", "Dün" or a formatted date.
 *
 * @param string $created MySQL datetime string.
 * @return string
 */
function oec_relative_date( $created ) {
	$created = trim( (string) $created );
	if ( '' === $created ) {
		return '';
	}

	$timestamp = strtotime( $created );
	if ( ! $timestamp ) {
		return '';
	}

	// wpForo stores topic dates in site local time, so compare calendar days
	// rather than raw offsets.
	$today     = current_time( 'Y-m-d' );
	$yesterday = gmdate( 'Y-m-d', strtotime( $today . ' -1 day' ) );
	$then      = gmdate( 'Y-m-d', $timestamp );

	if ( $then >= $today ) {
		return __( 'Bugün', 'ozel-egitim-sohbet' );
	}
	if ( $then === $yesterday ) {
		return __( 'Dün', 'ozel-egitim-sohbet' );
	}

	$days = (int) floor( ( strtotime( $today ) - strtotime( $then ) ) / DAY_IN_SECONDS );
	if ( $days > 1 && $days < 7 ) {
		/* translators: %d: number of days. */
		return sprintf( _n( '%d gün önce', '%d gün önce', $days, 'ozel-egitim-sohbet' ), $days );
	}

	return date_i18n( get_option( 'date_format' ), $timestamp );
}
