// ===== КОНСТАНТЫ =====
const BOT_TOKEN = '8597583917:AAFPOQqsJSe8vAxP0Af8VEEQwgKYH3iogT8';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_API_URL = 'https://ваш-сайт.ru/api/suggestions'; // URL вашего API

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let botOnline = false;
let messagesSent = 0;
let botStartTime = new Date();
let responses = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Бот-предложка загружен');
    
    // Загружаем данные
    loadMessagesCount();
    loadResponses();
    
    // Проверяем статус бота
    checkBotStatus();
    
    // Обновляем время работы
    setInterval(updateUptime, 1000);
    
    // Обновляем счётчик символов
    const messageText = document.getElementById('messageText');
    messageText.addEventListener('input', updateCharCount);
    
    // Симулируем загрузку ответов (в реальном приложении будет API)
    simulateResponses();
});

// ===== ЗАГРУЗКА ДАННЫХ =====
function loadMessagesCount() {
    messagesSent = parseInt(localStorage.getItem('messages_sent') || '0');
    document.getElementById('messagesSent').textContent = messagesSent;
}

function loadResponses() {
    const saved = localStorage.getItem('bot_responses');
    if (saved) {
        responses = JSON.parse(saved);
        updateResponsesUI();
    }
}

function saveResponses() {
    localStorage.setItem('bot_responses', JSON.stringify(responses));
}

// ===== ТЕЛЕГРАМ API =====
async function checkBotStatus() {
    const statusBadge = document.getElementById('botStatus');
    
    try {
        const response = await fetch(`${API_URL}/getMe`);
        const data = await response.json();
        
        if (data.ok) {
            botOnline = true;
            statusBadge.className = 'status-badge status-online';
            statusBadge.innerHTML = `
                <div class="status-dot online"></div>
                <span>Бот онлайн: ${data.result.first_name}</span>
            `;
            document.getElementById('botSubscribers').textContent = 'Загрузка...';
            updateBotInfo(data.result);
        } else {
            throw new Error(data.description);
        }
    } catch (error) {
        botOnline = false;
        statusBadge.className = 'status-badge status-offline';
        statusBadge.innerHTML = `
            <div class="status-dot offline"></div>
            <span>Бот офлайн</span>
        `;
        showStatusMessage('Бот недоступен. Проверьте токен.', 'error');
    }
}

async function sendMessage() {
    if (!botOnline) {
        showStatusMessage('Бот офлайн. Проверьте подключение.', 'error');
        return;
    }
    
    const recipient = document.getElementById('recipientSelector').value;
    const message = document.getElementById('messageText').value.trim();
    
    if (!recipient) {
        showStatusMessage('Выберите получателя', 'warning');
        return;
    }
    
    if (!message) {
        showStatusMessage('Введите сообщение', 'warning');
        return;
    }
    
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Отправка...', 'info');
    
    try {
        const response = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: recipient,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            // Обновляем статистику
            messagesSent++;
            localStorage.setItem('messages_sent', messagesSent.toString());
            document.getElementById('messagesSent').textContent = messagesSent;
            
            // Обновляем время последней активности
            updateLastActive();
            
            // Показываем успех
            showStatusMessage('<i class="fas fa-check-circle"></i> Сообщение отправлено!', 'success');
            
            // Очищаем поле
            document.getElementById('messageText').value = '';
            updateCharCount();
            
            // Сохраняем в историю
            saveMessageToHistory(message, recipient);
        } else {
            showStatusMessage(`<i class="fas fa-times-circle"></i> Ошибка: ${data.description}`, 'error');
        }
    } catch (error) {
        showStatusMessage('<i class="fas fa-times-circle"></i> Ошибка сети', 'error');
    }
}

async function sendTestMessage() {
    if (!botOnline) {
        showStatusMessage('Бот офлайн', 'error');
        return;
    }
    
    const recipient = document.getElementById('recipientSelector').value;
    
    if (!recipient) {
        showStatusMessage('Выберите получателя', 'warning');
        return;
    }
    
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Отправка теста...', 'info');
    
    const testMessage = `✅ <b>Тестовое сообщение от Бота-Предложки</b>\n\n` +
                       `Время: ${new Date().toLocaleTimeString()}\n` +
                       `Статус: Работает нормально!\n\n` +
                       `Это тестовое сообщение для проверки работы.`;
    
    try {
        const response = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: recipient,
                text: testMessage,
                parse_mode: 'HTML'
            })
        });
        
        if (response.ok) {
            showStatusMessage('<i class="fas fa-check-circle"></i> Тест отправлен!', 'success');
            messagesSent++;
            updateStats();
            updateLastActive();
        }
    } catch (error) {
        showStatusMessage('<i class="fas fa-times-circle"></i> Ошибка отправки', 'error');
    }
}

async function sendToBotUsers() {
    if (!botOnline) {
        showStatusMessage('Бот офлайн', 'error');
        return;
    }
    
    const message = document.getElementById('messageText').value.trim();
    
    if (!message) {
        showStatusMessage('Введите сообщение для рассылки', 'warning');
        return;
    }
    
    if (!confirm('Отправить сообщение всем подписчикам бота?')) {
        return;
    }
    
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Рассылка...', 'info');
    
    // В реальном приложении здесь будет запрос к API для получения списка пользователей
    // Пока что просто имитируем отправку
    
    setTimeout(() => {
        showStatusMessage('<i class="fas fa-check-circle"></i> Сообщение отправлено подписчикам!', 'success');
        messagesSent += 5; // Имитируем отправку 5 пользователям
        updateStats();
        updateLastActive();
        
        // Очищаем поле
        document.getElementById('messageText').value = '';
        updateCharCount();
    }, 2000);
}

// ===== ОТВЕТЫ С САЙТА =====
function refreshResponses() {
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Загрузка ответов...', 'info');
    
    // В реальном приложении здесь будет fetch к вашему API
    setTimeout(() => {
        // Имитируем получение новых ответов
        const newResponse = {
            id: Date.now(),
            user: 'Новый пользователь',
            userId: Math.floor(Math.random() * 1000),
            message: 'Это новый ответ с сайта! Пользователь оставил предложение через бота.',
            timestamp: new Date().toISOString(),
            read: false
        };
        
        responses.unshift(newResponse);
        updateResponsesUI();
        saveResponses();
        
        showStatusMessage('<i class="fas fa-check-circle"></i> Ответы обновлены', 'success');
    }, 1000);
}

function updateResponsesUI() {
    const container = document.getElementById('responsesContainer');
    const emptyState = document.getElementById('emptyResponses');
    const filter = document.getElementById('filterResponses').value;
    
    if (responses.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        updateResponseStats();
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Фильтруем ответы
    let filteredResponses = responses;
    const now = new Date();
    
    switch(filter) {
        case 'today':
            filteredResponses = responses.filter(r => {
                const date = new Date(r.timestamp);
                return date.toDateString() === now.toDateString();
            });
            break;
        case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredResponses = responses.filter(r => new Date(r.timestamp) > weekAgo);
            break;
        case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            filteredResponses = responses.filter(r => new Date(r.timestamp) > monthAgo);
            break;
    }
    
    // Отрисовываем ответы
    container.innerHTML = '';
    
    filteredResponses.forEach(response => {
        const item = document.createElement('div');
        item.className = 'response-item';
        
        const time = new Date(response.timestamp).toLocaleString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short'
        });
        
        item.innerHTML = `
            <div class="response-header">
                <div class="response-user">
                    <i class="fas fa-user"></i>
                    <span class="response-name">${response.user} (#${response.userId})</span>
                </div>
                <div class="response-time">${time}</div>
            </div>
            <div class="response-text">
                ${response.message}
            </div>
            <div class="response-actions">
                <button class="btn-icon small" onclick="replyToResponse(${response.id})" title="Ответить">
                    <i class="fas fa-reply"></i>
                </button>
                <button class="btn-icon small" onclick="deleteResponse(${response.id})" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        if (!response.read) {
            item.style.borderLeft = '3px solid var(--primary)';
            item.style.backgroundColor = 'var(--gray-50)';
        }
        
        container.appendChild(item);
    });
    
    updateResponseStats();
}

function updateResponseStats() {
    const now = new Date();
    const today = now.toDateString();
    
    const total = responses.length;
    const todayCount = responses.filter(r => 
        new Date(r.timestamp).toDateString() === today
    ).length;
    const unreadCount = responses.filter(r => !r.read).length;
    
    document.getElementById('totalResponses').textContent = total;
    document.getElementById('todayResponses').textContent = todayCount;
    document.getElementById('unreadResponses').textContent = unreadCount;
}

function replyToResponse(responseId) {
    const response = responses.find(r => r.id === responseId);
    if (!response) return;
    
    // Помечаем как прочитанное
    response.read = true;
    saveResponses();
    updateResponsesUI();
    
    // Предлагаем ответить
    const reply = prompt(`Ответить пользователю ${response.user} (#${response.userId}):`);
    if (reply && reply.trim()) {
        showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Отправка ответа...', 'info');
        
        // В реальном приложении здесь будет отправка ответа через Telegram API
        setTimeout(() => {
            showStatusMessage('<i class="fas fa-check-circle"></i> Ответ отправлен!', 'success');
            
            // Добавляем ответ в историю
            responses.push({
                id: Date.now(),
                user: 'Вы (админ)',
                userId: 0,
                message: `Ответ на сообщение #${responseId}: ${reply}`,
                timestamp: new Date().toISOString(),
                read: true,
                isReply: true
            });
            
            saveResponses();
            updateResponsesUI();
        }, 1000);
    }
}

function deleteResponse(responseId) {
    if (!confirm('Удалить этот ответ?')) return;
    
    responses = responses.filter(r => r.id !== responseId);
    saveResponses();
    updateResponsesUI();
    showStatusMessage('Ответ удалён', 'success');
}

// ===== УТИЛИТЫ =====
function updateCharCount() {
    const message = document.getElementById('messageText').value;
    document.getElementById('charCount').textContent = message.length;
    
    // Подсветка при превышении лимита
    if (message.length > 4000) {
        document.getElementById('charCount').style.color = 'var(--danger)';
    } else {
        document.getElementById('charCount').style.color = '';
    }
}

function updateUptime() {
    const now = new Date();
    const diff = Math.floor((now - botStartTime) / 1000);
    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    document.getElementById('botUptime').textContent = `${hours}:${minutes}:${seconds}`;
}

function updateLastActive() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('lastActive').textContent = timeStr;
}

function updateStats() {
    document.getElementById('messagesSent').textContent = messagesSent;
    localStorage.setItem('messages_sent', messagesSent.toString());
}

function updateBotInfo(botData) {
    // Можно добавить больше информации о боте
    console.log('Информация о боте:', botData);
}

function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('messageStatus');
    statusDiv.className = `status-message show ${type}`;
    statusDiv.innerHTML = message;
    
    if (type !== 'info') {
        setTimeout(() => {
            statusDiv.className = 'status-message';
            statusDiv.innerHTML = '';
        }, 3000);
    }
}

function saveMessageToHistory(message, recipient) {
    const history = JSON.parse(localStorage.getItem('message_history') || '[]');
    history.unshift({
        message: message,
        recipient: recipient,
        timestamp: new Date().toISOString()
    });
    
    // Храним только последние 50 сообщений
    if (history.length > 50) {
        history.pop();
    }
    
    localStorage.setItem('message_history', JSON.stringify(history));
}

function setupWebhook() {
    // В реальном приложении здесь будет настройка вебхука
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Настройка Webhook...', 'info');
    
    // Это пример URL для вебхука - замените на ваш
    const webhookUrl = `${window.location.origin}/webhook.php`;
    
    fetch(`${API_URL}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                document.getElementById('webhookStatus').textContent = 'Активен';
                document.getElementById('webhookStatus').style.color = 'var(--success)';
                showStatusMessage('<i class="fas fa-check-circle"></i> Webhook настроен!', 'success');
            } else {
                showStatusMessage(`<i class="fas fa-times-circle"></i> Ошибка: ${data.description}`, 'error');
            }
        })
        .catch(error => {
            showStatusMessage('<i class="fas fa-times-circle"></i> Ошибка сети', 'error');
        });
}

// ===== СИМУЛЯЦИЯ ДАННЫХ (для демо) =====
function simulateResponses() {
    // Создаём демо-ответы если их нет
    if (responses.length === 0) {
        const demoResponses = [
            {
                id: 1,
                user: 'Анонимный пользователь',
                userId: 123,
                message: 'Можно добавить тёмную тему на сайт?',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                read: true
            },
            {
                id: 2,
                user: 'Пользователь',
                userId: 456,
                message: 'Предлагаю добавить возможность загрузки фото в предложениях.',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                read: false
            },
            {
                id: 3,
                user: 'Тестировщик',
                userId: 789,
                message: 'Нашёл баг: при отправке пустого сообщения ничего не происходит.',
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                read: true
            }
        ];
        
        responses = demoResponses;
        saveResponses();
        updateResponsesUI();
    }
}
