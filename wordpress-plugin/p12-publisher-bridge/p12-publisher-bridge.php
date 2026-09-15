<?php
/**
 * Plugin Name:       P12 Publisher Bridge
 * Plugin URI:        https://github.com/contatop12/blog-power
 * Description:       Expõe campos de SEO (Yoast/Rank Math) e JSON-LD via REST API para o Publisher P12. Não envia dados a servidores externos.
 * Version:           1.2.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            P12 Editorial
 * License:           Proprietary
 * Text Domain:       p12-publisher-bridge
 *
 * Segurança:
 * - Bloqueia acesso direto ao arquivo (ABSPATH).
 * - Escrita de meta via REST apenas com capability edit_posts.
 * - Sanitização de campos e validação estrita do JSON-LD.
 * - Sem telemetria, sem chamadas HTTP externas, sem armazenamento de senhas.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('P12_BRIDGE_VERSION', '1.2.0');
/** Tamanho máximo do JSON-LD (bytes) — evita abuso de armazenamento. */
define('P12_BRIDGE_JSONLD_MAX_BYTES', 100000);

/**
 * Capability mínima para gravar meta via REST.
 */
function p12_bridge_can_edit_meta(): bool
{
    return current_user_can('edit_posts');
}

/**
 * Sanitiza textos curtos (título SEO, focus keyword).
 */
function p12_bridge_sanitize_text($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $value = wp_strip_all_tags($value);
    return sanitize_text_field($value);
}

/**
 * Sanitiza meta description.
 */
function p12_bridge_sanitize_textarea($value): string
{
    if (!is_string($value)) {
        return '';
    }
    return sanitize_textarea_field($value);
}

/**
 * Valida e normaliza JSON-LD. Rejeita JSON inválido, oversized ou não-objeto/array.
 *
 * @return string JSON re-encodeado seguro, ou string vazia se inválido.
 */
function p12_bridge_sanitize_jsonld($value): string
{
    if (!is_string($value)) {
        return '';
    }

    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    if (strlen($trimmed) > P12_BRIDGE_JSONLD_MAX_BYTES) {
        return '';
    }

    $decoded = json_decode($trimmed, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return '';
    }

    if (!is_array($decoded)) {
        return '';
    }

    $encoded = wp_json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || $encoded === '') {
        return '';
    }

    return $encoded;
}

/**
 * Prepara JSON-LD para impressão em <script> sem quebrar o HTML.
 */
function p12_bridge_jsonld_for_output(string $json): string
{
    // Impede quebra de contexto </script> (XSS via JSON malicioso).
    return str_replace('</', '<\/', $json);
}

/**
 * Registra meta fields usados pelo Publisher.
 */
function p12_bridge_register_meta_for_type(string $post_type): void
{
    $auth = 'p12_bridge_can_edit_meta';

    $fields = [
        '_yoast_wpseo_title'      => 'p12_bridge_sanitize_text',
        '_yoast_wpseo_metadesc'   => 'p12_bridge_sanitize_textarea',
        '_yoast_wpseo_focuskw'    => 'p12_bridge_sanitize_text',
        'rank_math_title'         => 'p12_bridge_sanitize_text',
        'rank_math_description'   => 'p12_bridge_sanitize_textarea',
        'rank_math_focus_keyword' => 'p12_bridge_sanitize_text',
        'p12_schema_jsonld'       => 'p12_bridge_sanitize_jsonld',
    ];

    foreach ($fields as $key => $sanitize) {
        register_post_meta($post_type, $key, [
            'type'              => 'string',
            'single'            => true,
            'show_in_rest'      => true,
            'auth_callback'     => $auth,
            'sanitize_callback' => $sanitize,
        ]);
    }
}

function p12_bridge_register_meta(): void
{
    p12_bridge_register_meta_for_type('post');
    p12_bridge_register_meta_for_type('page');
}
add_action('init', 'p12_bridge_register_meta');

/**
 * Injeta JSON-LD validado no <head> de posts e páginas publicados.
 */
function p12_bridge_print_jsonld(): void
{
    if (!is_singular(['post', 'page'])) {
        return;
    }

    $post_id = get_the_ID();
    if (!$post_id) {
        return;
    }

    // Só em posts publicados no front — evita vazar rascunhos.
    if (get_post_status($post_id) !== 'publish') {
        return;
    }

    $raw = get_post_meta($post_id, 'p12_schema_jsonld', true);
    if (!is_string($raw) || $raw === '') {
        return;
    }

    $safe = p12_bridge_sanitize_jsonld($raw);
    if ($safe === '') {
        return;
    }

    echo "\n<script type=\"application/ld+json\">"
        . p12_bridge_jsonld_for_output($safe)
        . "</script>\n";
}
add_action('wp_head', 'p12_bridge_print_jsonld', 20);
