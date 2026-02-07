<?php
// api.php
// API для получения предложений с сайта

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Простая авторизация (замените на свою)
$validToken = 'ваш_секретный_токен';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Проверяем токен (если требуется)
    if (isset($_GET['token']) && $_GET['token'] === $validToken) {
        $suggestionsFile = 'suggestions.json';
        
        if (file_exists($suggestionsFile)) {
            $suggestions = json_decode(file_get_contents($suggestionsFile), true);
            
            // Фильтруем по параметрам
            if (isset($_GET['unread']) && $_GET['unread'] === 'true') {
                $suggestions = array_filter($suggestions, function($suggestion) {
                    return !$suggestion['read'];
                });
            }
            
            if (isset($_GET['limit'])) {
                $limit = intval($_GET['limit']);
                $suggestions = array_slice($suggestions, 0, $limit);
            }
            
            echo json_encode([
                'success' => true,
                'count' => count($suggestions),
                'suggestions' => array_values($suggestions)
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'count' => 0,
                'suggestions' => []
            ]);
        }
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid token']);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Пометить как прочитанное
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['token']) && $input['token'] === $validToken && isset($input['id'])) {
        $suggestionsFile = 'suggestions.json';
        
        if (file_exists($suggestionsFile)) {
            $suggestions = json_decode(file_get_contents($suggestionsFile), true);
            
            foreach ($suggestions as &$suggestion) {
                if ($suggestion['id'] == $input['id']) {
                    $suggestion['read'] = true;
                    $suggestion['status'] = 'read';
                    break;
                }
            }
            
            file_put_contents($suggestionsFile, json_encode($suggestions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'No suggestions file']);
        }
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid request']);
    }
}
