<?php
// bot-webhook.php
// Обработчик вебхука для Telegram бота

require_once __DIR__ . '/vendor/autoload.php'; // Для Firebase Admin SDK

// Конфигурация
$botToken = '8597583917:AAFPOQqsJSe8vAxP0Af8VEEQwgKYH3iogT8';
$adminId = 'ВАШ_TELEGRAM_ID'; // Замените на ваш ID

// Получаем данные от Telegram
$update = json_decode(file_get_contents('php://input'), true);

if (isset($update['message'])) {
    $message = $update['message'];
    $chatId = $message['chat']['id'];
    $text = $message['text'] ?? '';
    $userId = $message['from']['id'];
    $userName = $message['from']['first_name'] ?? 'Аноним';
    $username = $message['from']['username'] ?? '';
    
    // Обработка команд
    if (strpos($text, '/') === 0) {
        handleCommand($chatId, $text, $userId, $userName);
    } else {
        // Сохраняем предложение в Firebase
        saveSuggestionToFirebase($userId, $userName, $username, $text, $chatId);
        
        // Отправляем подтверждение
        sendMessage($chatId, "✅ Спасибо, $userName! Ваше предложение сохранено и будет рассмотрено.");
        
        // Уведомляем администратора
        notifyAdmin($userId, $userName, $username, $text);
    }
}

function handleCommand($chatId, $text, $userId, $userName) {
    global $botToken;
    
    switch($text) {
        case '/start':
            $message = "👋 Привет, $userName!\n\n";
            $message .= "Я - бот для предложений. Просто отправь мне своё предложение, идею или замечание.\n\n";
            $message .= "Все предложения передаются администратору для рассмотрения.\n\n";
            $message .= "Напиши своё предложение, и я его сохраню!";
            sendMessage($chatId, $message);
            break;
            
        case '/help':
            $message = "📋 *Помощь*\n\n";
            $message .= "• Просто напиши сообщение - оно будет сохранено как предложение\n";
            $message .= "• Можно отправлять текст, идеи, замечания\n";
            $message .= "• Используй /start - начать работу\n";
            $message .= "• Используй /help - показать справку\n";
            $message .= "• Используй /status - проверить статус твоих предложений";
            sendMessage($chatId, $message);
            break;
            
        case '/status':
            $message = "📊 *Статус твоих предложений*\n\n";
            $message .= "Все предложения сохраняются в нашей базе.\n";
            $message .= "Администратор рассматривает их в порядке поступления.\n";
            $message .= "О результатах тебе сообщат отдельно.";
            sendMessage($chatId, $message);
            break;
            
        default:
            sendMessage($chatId, "Неизвестная команда. Используй /help для справки.");
    }
}

function saveSuggestionToFirebase($userId, $userName, $username, $text, $chatId) {
    // Здесь будет код сохранения в Firebase
    // Используйте Firebase Admin SDK
    
    $suggestionData = [
        'userId' => $userId,
        'userName' => $userName,
        'username' => $username,
        'message' => $text,
        'chatId' => $chatId,
        'timestamp' => date('Y-m-d H:i:s'),
        'read' => false,
        'answered' => false
    ];
    
    // Сохраняем в базу данных (пример для Firebase через cURL)
    $firebaseUrl = 'https://predlozhkabot-default-rtdb.firebaseio.com/suggestions.json';
    $ch = curl_init($firebaseUrl);
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($suggestionData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

function sendMessage($chatId, $text) {
    global $botToken;
    
    $url = "https://api.telegram.org/bot$botToken/sendMessage";
    $data = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'Markdown'
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
    global $botToken, $adminId;
    
    $message = "📩 *Новое предложение!*\n\n";
    $message .= "👤 *Пользователь:* $userName\n";
    if ($username) $message .= "📱 *Username:* @$username\n";
    $message .= "🆔 *ID:* $userId\n\n";
    $message .= "💭 *Предложение:*\n" . $text;
    
    sendMessage($adminId, $message);
}

// Ответ для Telegram
http_response_code(200);
echo 'OK';
