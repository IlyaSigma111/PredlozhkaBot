<?php
// webhook.php
// Этот файл обрабатывает входящие сообщения от Telegram бота

$botToken = '8597583917:AAFPOQqsJSe8vAxP0Af8VEEQwgKYH3iogT8';
$logFile = 'suggestions.log';

// Получаем входящие данные
$update = json_decode(file_get_contents('php://input'), true);

// Записываем логи
file_put_contents($logFile, date('Y-m-d H:i:s') . " - " . json_encode($update) . "\n", FILE_APPEND);

if (isset($update['message'])) {
    $message = $update['message'];
    $chatId = $message['chat']['id'];
    $text = $message['text'] ?? '';
    $userId = $message['from']['id'] ?? 0;
    $userName = $message['from']['first_name'] ?? 'Аноним';
    $username = $message['from']['username'] ?? '';
    
    // Сохраняем предложение в базу данных или файл
    saveSuggestion($userId, $userName, $username, $text, $chatId);
    
    // Отправляем подтверждение пользователю
    sendConfirmation($chatId, $userName);
    
    // Уведомляем администратора (если нужно)
    notifyAdmin($userId, $userName, $username, $text);
}

function saveSuggestion($userId, $userName, $username, $text, $chatId) {
    $suggestionsFile = 'suggestions.json';
    
    // Читаем существующие предложения
    $suggestions = [];
    if (file_exists($suggestionsFile)) {
        $suggestions = json_decode(file_get_contents($suggestionsFile), true);
    }
    
    // Добавляем новое предложение
    $newSuggestion = [
        'id' => time() . rand(100, 999),
        'userId' => $userId,
        'userName' => $userName,
        'username' => $username,
        'text' => $text,
        'chatId' => $chatId,
        'timestamp' => date('Y-m-d H:i:s'),
        'status' => 'new',
        'read' => false
    ];
    
    $suggestions[] = $newSuggestion;
    
    // Сохраняем обратно в файл
    file_put_contents($suggestionsFile, json_encode($suggestions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // Также можно сохранить в базу данных
    // saveToDatabase($newSuggestion);
}

function sendConfirmation($chatId, $userName) {
    global $botToken;
    
    $message = "✅ Спасибо, $userName!\n\n" .
               "Ваше предложение получено и будет рассмотрено.\n" .
               "Мы свяжемся с вами, если понадобятся уточнения.";
    
    $url = "https://api.telegram.org/bot$botToken/sendMessage";
    $data = [
        'chat_id' => $chatId,
        'text' => $message,
        'parse_mode' => 'HTML'
    ];
    
    $options = [
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    file_get_contents($url, false, $context);
}

function notifyAdmin($userId, $userName, $username, $text) {
    global $botToken;
    
    // ID администратора (замените на ваш)
    $adminChatId = 'ВАШ_ID_ТЕЛЕГРАМ';
    
    $message = "📩 <b>Новое предложение!</b>\n\n" .
               "👤 <b>Пользователь:</b> $userName\n" .
               ($username ? "📱 <b>Username:</b> @$username\n" : "") .
               "🆔 <b>ID:</b> $userId\n\n" .
               "💭 <b>Предложение:</b>\n" . $text;
    
    $url = "https://api.telegram.org/bot$botToken/sendMessage";
    $data = [
        'chat_id' => $adminChatId,
        'text' => $message,
        'parse_mode' => 'HTML'
    ];
    
    $options = [
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    file_get_contents($url, false, $context);
}

// Возвращаем успешный ответ
http_response_code(200);
echo 'OK';
