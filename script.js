// script.js
// Основной скрипт с интеграцией Firebase

// ===== КОНСТАНТЫ =====
const BOT_TOKEN = '8597583917:AAFPOQqsJSe8vAxP0Af8VEEQwgKYH3iogT8';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let botOnline = false;
let messagesSent = 0;
let botStartTime = new Date();
let db = null;
let currentPage = 1;
const pageSize = 10;
let currentFilter = 'all';
let currentReplySuggestion = null;
let suggestionsListener = null;
let activityChart = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Бот-предложка загружен');
    
    // Инициализируем Firebase
    await initializeFirebase();
    
    // Загружаем статистику
    loadStats();
    
    // Проверяем статус бота
    checkBotStatus();
    
    // Обновляем время работы
    setInterval(updateUptime, 1000);
    
    // Обновляем счётчик символов
    document.getElementById('messageText').addEventListener('input', updateCharCount);
    
    // Инициализируем поле получателя
    updateRecipientField();
    
    // Загружаем предложения из Firebase
    loadSuggestions();
    
    // Загружаем аналитику
    loadAnalytics();
});

// ===== FIREBASE ФУНКЦИИ =====
async function initializeFirebase() {
    try {
        // Проверяем, что Firebase загружен
        if (!window.firebaseDB) {
            throw new Error("Firebase не инициализирован");
        }
        
        db = window.firebaseDB;
        
        // Проверяем подключение
        await db.collection('test').doc('test').get();
        
        // Обновляем статус Firebase
        document.getElementById('firebaseStatus').className = 'status-dot online';
        document.getElementById('firebaseStatusText').textContent = 'Подключено';
        document.getElementById('firebaseStatusText').style.color = '#10b981';
        
        console.log("Firebase успешно подключен");
        
        // Настраиваем реальное обновление данных
        setupRealtimeUpdates();
        
        // Обновляем время последней синхронизации
        updateLastSync();
        
    } catch (error) {
        console.error("Ошибка подключения Firebase:", error);
        document.getElementById('firebaseStatus').className = 'status-dot offline';
        document.getElementById('firebaseStatusText').textContent = 'Ошибка подключения';
        document.getElementById('firebaseStatusText').style.color = '#ef4444';
    }
}

function setupRealtimeUpdates() {
    // Отписываемся от предыдущего слушателя
    if (suggestionsListener) {
        suggestionsListener();
    }
    
    // Подписываемся на обновления предложений
    suggestionsListener = db.collection('suggestions')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
            console.log("Получены обновления из Firebase");
            updateLastSync();
            
            // Обновляем UI с новыми данными
            const suggestions = [];
            snapshot.forEach((doc) => {
                suggestions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            updateSuggestionsUI(suggestions);
            updateAnalytics(suggestions);
        }, (error) => {
            console.error("Ошибка получения обновлений:", error);
        });
}

async function saveSuggestionToFirebase(suggestion) {
    if (!db) {
        console.error("Firebase не инициализирован");
        return null;
    }
    
    try {
        const docRef = await db.collection('suggestions').add({
            ...suggestion,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false,
            answered: false
        });
        
        console.log("Предложение сохранено в Firebase с ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Ошибка сохранения в Firebase:", error);
        return null;
    }
}

async function updateSuggestionInFirebase(suggestionId, updates) {
    if (!db) {
        console.error("Firebase не инициализирован");
        return false;
    }
    
    try {
        await db.collection('suggestions').doc(suggestionId).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log("Предложение обновлено в Firebase:", suggestionId);
        return true;
    } catch (error) {
        console.error("Ошибка обновления в Firebase:", error);
        return false;
    }
}

async function getSuggestionsFromFirebase(page = 1, filter = 'all') {
    if (!db) {
        console.error("Firebase не инициализирован");
        return [];
    }
    
    try {
        let query = db.collection('suggestions').orderBy('timestamp', 'desc');
        
        // Применяем фильтры
        if (filter === 'new') {
            query = query.where('read', '==', false);
        } else if (filter === 'answered') {
            query = query.where('answered', '==', true);
        }
        
        // Пагинация
        const startAt = (page - 1) * pageSize;
        const snapshot = await query.limit(pageSize).get();
        
        const suggestions = [];
        snapshot.forEach((doc) => {
            suggestions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return suggestions;
    } catch (error) {
        console.error("Ошибка получения данных из Firebase:", error);
        return [];
    }
}

// ===== ТЕЛЕГРАМ API ФУНКЦИИ =====
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
            
            // Обновляем информацию о боте
            document.getElementById('botTokenDisplay').textContent = BOT_TOKEN;
            updateSubscribersCount();
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
        showStatusMessage('⚠️ Бот недоступен. Проверьте токен и интернет.', 'error');
    }
}

async function sendMessage() {
    if (!botOnline) {
        showStatusMessage('❌ Бот офлайн. Проверьте подключение.', 'error');
        return;
    }
    
    const sendType = document.getElementById('sendType').value;
    const message = document.getElementById('messageText').value.trim();
    
    if (!message) {
        showStatusMessage('❌ Введите сообщение', 'error');
        return;
    }
    
    if (sendType === 'user') {
        const chatId = document.getElementById('userId').value.trim();
        if (!chatId || !/^-?\d+$/.test(chatId)) {
            showStatusMessage('❌ Введите корректный ID пользователя', 'error');
            return;
        }
        
        await sendToUser(chatId, message);
        
    } else if (sendType === 'all') {
        if (!confirm('Отправить сообщение всем пользователям из базы?')) return;
        await sendToAllUsers(message);
        
    } else if (sendType === 'test') {
        // Для теста отправляем себе (замените на ваш ID)
        const testUserId = 'ВАШ_TELEGRAM_ID'; // Замените здесь!
        if (!testUserId || testUserId === 'ВАШ_TELEGRAM_ID') {
            showStatusMessage('⚠️ Укажите ваш Telegram ID в коде для теста', 'error');
            return;
        }
        await sendToUser(testUserId, message);
    }
}

async function sendToUser(chatId, message) {
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Отправка...', 'info');
    
    try {
        const response = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            // Обновляем статистику
            messagesSent++;
            localStorage.setItem('messages_sent', messagesSent.toString());
            document.getElementById('messagesSentCount').textContent = messagesSent;
            
            showStatusMessage('✅ Сообщение отправлено!', 'success');
            
            // Сохраняем в историю
            await saveMessageToHistory(chatId, message);
            
            // Очищаем форму
            clearForm();
        } else {
            showStatusMessage(`❌ Ошибка: ${data.description}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showStatusMessage('❌ Ошибка сети при отправке', 'error');
    }
}

async function sendToAllUsers(message) {
    if (!db) {
        showStatusMessage('❌ Firebase не подключен', 'error');
        return;
    }
    
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Получаю список пользователей...', 'info');
    
    try {
        // Получаем уникальных пользователей из предложений
        const snapshot = await db.collection('suggestions').get();
        const users = new Set();
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userId) {
                users.add(data.userId);
            }
        });
        
        const userIds = Array.from(users);
        
        if (userIds.length === 0) {
            showStatusMessage('❌ Нет пользователей в базе', 'error');
            return;
        }
        
        if (!confirm(`Отправить сообщение ${userIds.length} пользователям?`)) return;
        
        showStatusMessage(`<i class="fas fa-spinner fa-spin"></i> Рассылка ${userIds.length} пользователям...`, 'info');
        
        let successCount = 0;
        let failCount = 0;
        
        // Отправляем каждому пользователю
        for (const userId of userIds) {
            try {
                const response = await fetch(`${API_URL}/sendMessage`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        chat_id: userId,
                        text: message,
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    })
                });
                
                const data = await response.json();
                if (data.ok) {
                    successCount++;
                    messagesSent++;
                } else {
                    failCount++;
                    console.error(`Ошибка отправки пользователю ${userId}:`, data.description);
                }
                
                // Задержка между сообщениями
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                failCount++;
                console.error(`Ошибка сети для пользователя ${userId}:`, error);
            }
        }
        
        // Обновляем статистику
        localStorage.setItem('messages_sent', messagesSent.toString());
        document.getElementById('messagesSentCount').textContent = messagesSent;
        
        showStatusMessage(`✅ Отправлено: ${successCount}, Не отправлено: ${failCount}`, 'success');
        
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        showStatusMessage('❌ Ошибка получения данных', 'error');
    }
}

// ===== РАБОТА С ПРЕДЛОЖЕНИЯМИ =====
async function loadSuggestions() {
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Загрузка предложений...', 'info');
    
    try {
        const suggestions = await getSuggestionsFromFirebase(currentPage, currentFilter);
        updateSuggestionsUI(suggestions);
        updatePagination();
        showStatusMessage('✅ Предложения загружены', 'success');
    } catch (error) {
        showStatusMessage('❌ Ошибка загрузки предложений', 'error');
    }
}

function updateSuggestionsUI(suggestions) {
    const container = document.getElementById('suggestionsContainer');
    const emptyState = document.getElementById('emptySuggestions');
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        updateSuggestionsStats(suggestions);
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    suggestions.forEach((suggestion, index) => {
        const element = createSuggestionElement(suggestion, index);
        container.appendChild(element);
    });
    
    updateSuggestionsStats(suggestions);
}

function createSuggestionElement(suggestion, index) {
    const div = document.createElement('div');
    div.className = `suggestion-item ${suggestion.read ? '' : 'new'}`;
    div.dataset.id = suggestion.id;
    
    // Форматируем время
    let timeText = 'Недавно';
    if (suggestion.timestamp && suggestion.timestamp.toDate) {
        const date = suggestion.timestamp.toDate();
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            timeText = 'Только что';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            timeText = `${minutes} мин. назад`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            timeText = `${hours} ч. назад`;
        } else {
            timeText = date.toLocaleDateString('ru-RU');
        }
    }
    
    // Форматируем текст сообщения
    let messageText = suggestion.message || 'Нет текста';
    if (messageText.length > 200) {
        messageText = messageText.substring(0, 200) + '...';
    }
    
    div.innerHTML = `
        <div class="suggestion-header">
            <div class="suggestion-user">
                <i class="fas fa-user-circle"></i>
                <div class="suggestion-user-info">
                    <span class="suggestion-name">${suggestion.userName || 'Аноним'}</span>
                    <span class="suggestion-id">ID: ${suggestion.userId || 'Неизвестен'}</span>
                </div>
            </div>
            <div class="suggestion-time">${timeText}</div>
        </div>
        <div class="suggestion-text">
            ${messageText}
        </div>
        <div class="suggestion-actions">
            <button class="btn-icon small" onclick="openReplyModal('${suggestion.id}')" 
                    title="Ответить" ${suggestion.answered ? 'disabled' : ''}>
                <i class="fas fa-reply"></i>
            </button>
            <button class="btn-icon small" onclick="markAsRead('${suggestion.id}')" 
                    title="${suggestion.read ? 'Пометить непрочитанным' : 'Пометить прочитанным'}">
                <i class="fas ${suggestion.read ? 'fa-envelope' : 'fa-check'}"></i>
            </button>
            <button class="btn-icon small danger" onclick="deleteSuggestion('${suggestion.id}')" 
                    title="Удалить">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        ${suggestion.answered ? '<div class="answered-badge"><i class="fas fa-check-circle"></i> С ответом</div>' : ''}
    `;
    
    return div;
}

async function openReplyModal(suggestionId) {
    if (!db) return;
    
    try {
        const doc = await db.collection('suggestions').doc(suggestionId).get();
        if (!doc.exists) {
            showStatusMessage('❌ Предложение не найдено', 'error');
            return;
        }
        
        const suggestion = doc.data();
        currentReplySuggestion = {
            id: suggestionId,
            ...suggestion
        };
        
        // Заполняем модальное окно
        document.getElementById('originalMessage').innerHTML = `
            <strong>${suggestion.userName || 'Аноним'}:</strong><br>
            ${suggestion.message || 'Нет текста'}
        `;
        
        // Настраиваем форму ответа
        document.getElementById('sendType').value = 'user';
        document.getElementById('userId').value = suggestion.userId || '';
        document.getElementById('messageText').value = `Уважаемый ${suggestion.userName || 'пользователь'}!\n\n`;
        
        // Показываем модальное окно
        document.getElementById('replyModal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
        showStatusMessage('❌ Ошибка загрузки предложения', 'error');
    }
}

function closeModal() {
    document.getElementById('replyModal').style.display = 'none';
    currentReplySuggestion = null;
}

async function sendReply() {
    if (!currentReplySuggestion) return;
    
    const replyText = document.getElementById('replyText').value.trim();
    if (!replyText) {
        showStatusMessage('❌ Введите текст ответа', 'error');
        return;
    }
    
    // Отправляем сообщение пользователю
    await sendToUser(currentReplySuggestion.userId, replyText);
    
    // Обновляем статус предложения в Firebase
    await updateSuggestionInFirebase(currentReplySuggestion.id, {
        answered: true,
        answer: replyText,
        answeredAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Закрываем модальное окно
    closeModal();
    showStatusMessage('✅ Ответ отправлен и сохранён', 'success');
}

async function markAsRead(suggestionId) {
    if (!db) return;
    
    try {
        const doc = await db.collection('suggestions').doc(suggestionId).get();
        if (!doc.exists) return;
        
        const suggestion = doc.data();
        await updateSuggestionInFirebase(suggestionId, {
            read: !suggestion.read
        });
        
        showStatusMessage(`✅ Предложение помечено как ${suggestion.read ? 'непрочитанное' : 'прочитанное'}`, 'success');
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showStatusMessage('❌ Ошибка обновления', 'error');
    }
}

async function deleteSuggestion(suggestionId) {
    if (!confirm('Удалить это предложение? Это действие нельзя отменить.')) return;
    
    if (!db) return;
    
    try {
        await db.collection('suggestions').doc(suggestionId).delete();
        showStatusMessage('✅ Предложение удалено', 'success');
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showStatusMessage('❌ Ошибка удаления', 'error');
    }
}

// ===== АНАЛИТИКА И СТАТИСТИКА =====
async function loadAnalytics() {
    if (!db) return;
    
    try {
        const snapshot = await db.collection('suggestions').get();
        const suggestions = [];
        snapshot.forEach((doc) => {
            suggestions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateAnalytics(suggestions);
        updateActivityChart(suggestions);
        updateTopUsers(suggestions);
        
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
    }
}

function updateAnalytics(suggestions) {
    if (!suggestions) return;
    
    const total = suggestions.length;
    const newCount = suggestions.filter(s => !s.read).length;
    const answeredCount = suggestions.filter(s => s.answered).length;
    
    document.getElementById('totalSuggestions').textContent = total;
    document.getElementById('newSuggestions').textContent = newCount;
    document.getElementById('answeredSuggestions').textContent = answeredCount;
}

function updateActivityChart(suggestions) {
    // Группируем по дням
    const activityByDay = {};
    
    suggestions.forEach(suggestion => {
        if (suggestion.timestamp && suggestion.timestamp.toDate) {
            const date = suggestion.timestamp.toDate();
            const dayKey = date.toISOString().split('T')[0];
            
            if (!activityByDay[dayKey]) {
                activityByDay[dayKey] = 0;
            }
            activityByDay[dayKey]++;
        }
    });
    
    // Сортируем по дате
    const sortedDays = Object.keys(activityByDay).sort();
    const last7Days = sortedDays.slice(-7);
    
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    if (activityChart) {
        activityChart.destroy();
    }
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(day => {
                const d = new Date(day);
                return d.toLocaleDateString('ru-RU', { weekday: 'short' });
            }),
            datasets: [{
                label: 'Предложений в день',
                data: last7Days.map(day => activityByDay[day] || 0),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateTopUsers(suggestions) {
    // Группируем по пользователям
    const userStats = {};
    
    suggestions.forEach(suggestion => {
        const userId = suggestion.userId;
        if (!userId) return;
        
        if (!userStats[userId]) {
            userStats[userId] = {
                count: 0,
                name: suggestion.userName || 'Аноним',
                lastActivity: suggestion.timestamp
            };
        }
        
        userStats[userId].count++;
        
        // Обновляем последнюю активность
        if (suggestion.timestamp && suggestion.timestamp.toDate) {
            const suggestionTime = suggestion.timestamp.toDate().getTime();
            const currentTime = userStats[userId].lastActivity && userStats[userId].lastActivity.toDate 
                ? userStats[userId].lastActivity.toDate().getTime()
                : 0;
            
            if (suggestionTime > currentTime) {
                userStats[userId].lastActivity = suggestion.timestamp;
            }
        }
    });
    
    // Сортируем по количеству предложений
    const topUsers = Object.entries(userStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);
    
    const container = document.getElementById('topUsers');
    container.innerHTML = '';
    
    topUsers.forEach(([userId, stats], index) => {
        const div = document.createElement('div');
        div.className = 'top-user-item';
        div.innerHTML = `
            <div class="top-user-rank">${index + 1}</div>
            <div class="top-user-info">
                <div class="top-user-name">${stats.name}</div>
                <div class="top-user-id">ID: ${userId}</div>
            </div>
            <div class="top-user-count">${stats.count}</div>
        `;
        container.appendChild(div);
    });
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function updateRecipientField() {
    const sendType = document.getElementById('sendType').value;
    const recipientGroup = document.getElementById('recipientGroup');
    
    if (sendType === 'user' || sendType === 'test') {
        recipientGroup.style.display = 'block';
        document.getElementById('userId').placeholder = sendType === 'test' 
            ? 'Ваш Telegram ID для теста' 
            : 'Введите Telegram ID пользователя';
    } else {
        recipientGroup.style.display = 'none';
    }
}

function formatText(type) {
    const textarea = document.getElementById('messageText');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = '';
    
    switch(type) {
        case 'bold':
            formattedText = `<b>${selectedText}</b>`;
            break;
        case 'italic':
            formattedText = `<i>${selectedText}</i>`;
            break;
        case 'code':
            formattedText = `<code>${selectedText}</code>`;
            break;
        case 'link':
            const url = prompt('Введите URL:', 'https://');
            if (url) {
                const text = prompt('Текст ссылки:', selectedText || 'ссылка');
                formattedText = `<a href="${url}">${text}</a>`;
            }
            break;
    }
    
    if (formattedText) {
        textarea.value = textarea.value.substring(0, start) + 
                        formattedText + 
                        textarea.value.substring(end);
        updateCharCount();
    }
}

function previewMessage() {
    const message = document.getElementById('messageText').value;
    if (!message) {
        showStatusMessage('❌ Нет текста для предпросмотра', 'error');
        return;
    }
    
    // Создаём временный элемент для предпросмотра
    const preview = message
        .replace(/<b>(.*?)<\/b>/g, '**$1**')
        .replace(/<i>(.*?)<\/i>/g, '*$1*')
        .replace(/<code>(.*?)<\/code>/g, '`$1`')
        .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)');
    
    alert(`📝 Предпросмотр сообщения:\n\n${preview}\n\n👉 HTML-теги будут корректно отображаться в Telegram`);
}

function addTemplate() {
    const templates = [
        'Спасибо за ваше предложение! Мы его рассмотрим в ближайшее время.',
        'Ваше предложение принято в работу. Мы свяжемся с вами для уточнений.',
        'Благодарим за обратную связь! Ваше замечание очень ценно для нас.',
        'Предложение получено. Наша команда уже изучает его.',
        'Спасибо за идею! Мы добавим её в список планируемых улучшений.'
    ];
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    const textarea = document.getElementById('messageText');
    const currentText = textarea.value;
    
    if (currentText && !currentText.endsWith('\n\n')) {
        textarea.value = currentText + '\n\n' + randomTemplate;
    } else {
        textarea.value = currentText + randomTemplate;
    }
    
    updateCharCount();
}

function clearForm() {
    document.getElementById('messageText').value = '';
    document.getElementById('userId').value = '';
    updateCharCount();
    showStatusMessage('🧹 Форма очищена', 'info');
}

function updateCharCount() {
    const message = document.getElementById('messageText').value;
    const count = message.length;
    const counter = document.getElementById('charCount');
    
    counter.textContent = count;
    
    if (count > 4000) {
        counter.style.color = 'var(--danger)';
        counter.style.fontWeight = 'bold';
    } else if (count > 3500) {
        counter.style.color = 'var(--warning)';
        counter.style.fontWeight = 'bold';
    } else {
        counter.style.color = '';
        counter.style.fontWeight = '';
    }
}

function updateUptime() {
    const now = new Date();
    const diff = Math.floor((now - botStartTime) / 1000);
    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    
    document.getElementById('uptimeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
}

function updateLastSync() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('lastSync').textContent = timeStr;
}

function updatePagination() {
    document.getElementById('pageInfo').textContent = `Страница ${currentPage}`;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadSuggestions();
    }
}

function nextPage() {
    currentPage++;
    loadSuggestions();
}

function filterSuggestions(filter) {
    currentFilter = filter;
    currentPage = 1;
    
    // Обновляем активные кнопки
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadSuggestions();
}

async function exportSuggestions() {
    if (!db) return;
    
    showStatusMessage('<i class="fas fa-spinner fa-spin"></i> Подготовка экспорта...', 'info');
    
    try {
        const snapshot = await db.collection('suggestions').get();
        const suggestions = [];
        
        snapshot.forEach((doc) => {
            suggestions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Формируем CSV
        let csv = 'ID,Пользователь,Telegram ID,Сообщение,Дата,Прочитано,С ответом\n';
        
        suggestions.forEach(suggestion => {
            const date = suggestion.timestamp && suggestion.timestamp.toDate 
                ? suggestion.timestamp.toDate().toLocaleString('ru-RU')
                : 'Неизвестно';
            
            const row = [
                suggestion.id,
                suggestion.userName || 'Аноним',
                suggestion.userId || '',
                `"${(suggestion.message || '').replace(/"/g, '""')}"`,
                date,
                suggestion.read ? 'Да' : 'Нет',
                suggestion.answered ? 'Да' : 'Нет'
            ].join(',');
            
            csv += row + '\n';
        });
        
        // Скачиваем файл
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `предложения_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showStatusMessage('✅ Данные экспортированы в CSV', 'success');
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showStatusMessage('❌ Ошибка экспорта данных', 'error');
    }
}

function copyToken() {
    navigator.clipboard.writeText(BOT_TOKEN)
        .then(() => showStatusMessage('✅ Токен скопирован в буфер', 'success'))
        .catch(() => showStatusMessage('❌ Ошибка копирования', 'error'));
}

async function updateSubscribersCount() {
    if (!db) return;
    
    try {
        // Получаем уникальных пользователей
        const snapshot = await db.collection('suggestions').get();
        const users = new Set();
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userId) {
                users.add(data.userId);
            }
        });
        
        document.getElementById('subscribersCount').textContent = users.size;
    } catch (error) {
        console.error('Ошибка получения подписчиков:', error);
    }
}

async function saveMessageToHistory(userId, message) {
    if (!db) return;
    
    try {
        await db.collection('messages').add({
            userId: userId,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'outgoing'
        });
    } catch (error) {
        console.error('Ошибка сохранения истории:', error);
    }
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

function loadStats() {
    messagesSent = parseInt(localStorage.getItem('messages_sent') || '0');
    document.getElementById('messagesSentCount').textContent = messagesSent;
}

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ =====
async function loadStats() {
    messagesSent = parseInt(localStorage.getItem('messages_sent') || '0');
    document.getElementById('messagesSentCount').textContent = messagesSent;
}

function updateSuggestionsStats(suggestions) {
    if (!suggestions) return;
    
    const total = suggestions.length;
    const newCount = suggestions.filter(s => !s.read).length;
    const answeredCount = suggestions.filter(s => s.answered).length;
    
    document.getElementById('totalSuggestions').textContent = total;
    document.getElementById('newSuggestions').textContent = newCount;
    document.getElementById('answeredSuggestions').textContent = answeredCount;
}
