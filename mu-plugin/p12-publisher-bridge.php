<?php
/**
 * Plugin Name: P12 Publisher Bridge
 * Description: Expõe campos de SEO e JSON-LD via REST API para publicação automatizada.
 * Version: 1.0
 */

add_action('init', function () {
    $auth = function () { return current_user_can('edit_posts'); };

    $fields = [
        // Yoast SEO
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
        '_yoast_wpseo_focuskw',
        // Rank Math
        'rank_math_title',
        'rank_math_description',
        'rank_math_focus_keyword',
        // JSON-LD próprio da P12
        'p12_schema_jsonld',
    ];

    foreach ($fields as $key) {
        register_post_meta('post', $key, [
            'type'          => 'string',
            'single'        => true,
            'show_in_rest'  => true,
            'auth_callback' => $auth,
        ]);
    }
});

// Injeta o JSON-LD próprio no <head>
add_action('wp_head', function () {
    if (!is_singular('post')) return;
    $json = get_post_meta(get_the_ID(), 'p12_schema_jsonld', true);
    if (!$json) return;
    echo "\n<script type=\"application/ld+json\">" . $json . "</script>\n";
}, 20);
