// ===== КОНСТАНТЫ И КОНФИГУРАЦИЯ =====
const BOT_TOKEN = '8597583917:AAFPOQqsJSe8vAxP0Af8VEEQwgKYH3iogT8';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Firebase конфигурация
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB5l0kA2rLyEy21zsosJTU0M_vxJHS5Qpk",
    authDomain: "predlozhkabot.firebaseapp.com",
    databaseURL: "https://predlozhkabot-default-rtdb.firebaseio.com",
    projectId: "predlozhkabot",
    storageBucket: "predlozhkabot.firebasestorage.app",
    messagingSenderId: "869552257549",
    appId: "1:869552257549:web:d2c0569096aa8ebe78b344"
};

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let botOnline = false;
let messagesSent = 0;
let db = null;
let currentPage = 1;
const pageSize = 10;
let currentFilter = 'all';
let currentReplySuggestion = null;
let suggestionsListener = null;
let allSuggestions = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Бот-предложка инициализирован');
    
    try {
        // Инициализируем Firebase
        await initializeFirebase();
        
        // Загружаем статистику из localStorage
        loadLocalStats();
        
        // Проверяем статус бота
        checkBotStatus();
        
        // Обновляем время
        updateTime();
        setInterval(updateTime, 1000);
        
        // Настраиваем UI
        document.getElementById('messageText').addEventListener('input', updateCharCount);
        updateRecipientField();
        
        // Загружаем данные из Firebase
        loadFirebaseData();
        
        // Настраиваем обновление в реальном времени
        setupRealtimeUpdates();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showStatus('Система не загружена. Проверьте подключение к Firebase.', 'error');
    }
});

// ===== FIREBASE =====
async function initializeFirebase() {
    try {
        // Инициализируем Firebase
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
        
        // Проверяем подключение
        await db.collection('test').doc('test').get();
        
        // Обновляем статус
        updateFirebaseStatus(true);
        console.log('✅ Firebase подключен');
        
    } catch (error) {
        console.error('❌ Ошибка Firebase:', error);
        updateFirebaseStatus(false);
        throw error;
    }
}

function updateFirebaseStatus(connected) {
    const statusEl = document.getElementById('firebaseStatusText');
    if (connected) {
        statusEl.textContent = 'Подключено';
        statusEl.style.color = '#10b981';
        statusEl.parentElement.querySelector('.status-dot').className = 'status-dot online';
    } else {
        statusEl.textContent = 'Ошибка';
        statusEl.style.color = '#ef4444';
        statusEl.parentElement.querySelector('.status-dot').className = 'status-dot offline';
    }
}

function setupRealtimeUpdates() {
    if (!db) return;
    
    // Отписываемся от старого слушателя
    if (suggestionsListener) {
        suggestionsListener();
    }
    
    // Подписываемся на обновления
    suggestionsListener = db.collection('suggestions')
        .orderBy('timestamp', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📥 Получены обновления из Firebase');
            
            allSuggestions = [];
            snapshot.forEach((doc) => {
                allSuggestions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Обновляем UI
            updateSuggestionsUI();
            updateStats();
            updateLastUpdateTime();
        }, (error) => {
            console.error('❌ Ошибка обновлений:', error);
        });
}

async function loadFirebaseData() {
    if (!db) return;
    
    try {
        const snapshot = await db.collection('suggestions').get();
        allSuggestions = [];
        
        snapshot.forEach((doc) => {
            allSuggestions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateSuggestionsUI();
        updateStats();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
    }
}

// ===== TELEGRAM API =====
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
            
            document.getElementById('botStatusText').textContent = 'В сети';
            document.getElementById('botTokenText').textContent = BOT_TOKEN;
            
            console.log('✅ Бот подключен');
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
        
        document.getElementById('botStatusText').textContent = 'Офлайн';
        showStatus('⚠️ Бот недоступен. Проверьте токен.', 'error');
    }
}

async function sendMessage() {
    if (!botOnline) {
        showStatus('❌ Бот офлайн. Проверьте подключение.', 'error');
        return;
    }
    
    const sendType = document.getElementById('sendType').value;
    const message = document.getElementById('messageText').value.trim();
    
    if (!message) {
        showStatus('❌ Введите сообщение', 'error');
        return;
    }
    
    if (sendType === 'user') {
        const userId = document.getElementById('userId').value.trim();
        if (!userId) {
            showStatus('❌ Введите ID пользователя', 'error');
            return;
        }
        
        await sendToUser(userId, message);
        
    } else if (sendType === 'broadcast') {
        if (!confirm('Отправить сообщение всем пользователям из базы?')) return;
        await sendBroadcast(message);
        
    } else if (sendType === 'test') {
        // Для теста - замените на свой Telegram ID
        const testId = 'ВАШ_TELEGRAM_ID';
        if (!testId || testId === 'ВАШ_TELEGRAM_ID') {
            showStatus('⚠️ Укажите ваш Telegram ID в коде', 'error');
            return;
        }
        await sendToUser(testId, message);
    }
}

async function sendToUser(userId, message) {
    showStatus('<i class="fas fa-spinner fa-spin"></i> Отправка...', 'info');
    
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
            // Увеличиваем счётчик
            messagesSent++;
            localStorage.setItem('messages_sent', messagesSent);
            document.getElementById('sentCount').textContent = messagesSent;
            
            showStatus('✅ Сообщение отправлено!', 'success');
            clearForm();
            
            // Сохраняем в историю
            saveToHistory(userId, message);
            
        } else {
            showStatus(`❌ Ошибка: ${data.description}`, 'error');
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showStatus('❌ Ошибка сети', 'error');
    }
}

async function sendBroadcast(message) {
    if (!db || allSuggestions.length === 0) {
        showStatus('❌ Нет пользователей для рассылки', 'error');
        return;
    }
    
    // Получаем уникальных пользователей
    const users = [...new Set(allSuggestions.map(s => s.userId).filter(id => id))];
    
    if (users.length === 0) {
        showStatus('❌ Нет пользователей в базе', 'error');
        return;
    }
    
    showStatus(`<i class="fas fa-spinner fa-spin"></i> Рассылка ${users.length} пользователям...`, 'info');
    
    let success = 0;
    let failed = 0;
    
    for (const userId of users) {
        try {
            const response = await fetch(`${API_URL}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    chat_id: userId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            
            if (response.ok) {
                success++;
                messagesSent++;
                
                // Небольшая задержка между сообщениями
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
    }
    
    // Обновляем статистику
    localStorage.setItem('messages_sent', messagesSent);
    document.getElementById('sentCount').textContent = messagesSent;
    
    showStatus(`✅ Отправлено: ${success}, Не отправлено: ${failed}`, 'success');
}

// ===== РАБОТА С ПРЕДЛОЖЕНИЯМИ =====
function updateSuggestionsUI() {
    const container = document.getElementById('suggestionsContainer');
    const emptyState = document.getElementById('emptySuggestions');
    
    if (!allSuggestions || allSuggestions.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Фильтруем предложения
    let filtered = allSuggestions;
    if (currentFilter === 'new') {
        filtered = allSuggestions.filter(s => !s.read);
    } else if (currentFilter === 'answered') {
        filtered = allSuggestions.filter(s => s.answered);
    }
    
    // Пагинация
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageSuggestions = filtered.slice(start, end);
    
    // Обновляем пагинацию
    updatePagination(filtered.length);
    
    // Отрисовываем предложения
    container.innerHTML = '';
    pageSuggestions.forEach((suggestion, index) => {
        container.appendChild(createSuggestionElement(suggestion, start + index));
    });
}

function createSuggestionElement(suggestion, index) {
    const div = document.createElement('div');
    div.className = `suggestion-item ${suggestion.read ? '' : 'new'}`;
    
    // Форматируем время
    let timeText = 'Недавно';
    if (suggestion.timestamp) {
        const date = suggestion.timestamp.toDate ? suggestion.timestamp.toDate() : new Date(suggestion.timestamp);
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
    
    // Форматируем текст
    const message = suggestion.message || 'Нет текста';
    const shortMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
    
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
            ${shortMessage}
        </div>
        <div class="suggestion-actions">
            <button class="btn-icon" onclick="replyToSuggestion('${suggestion.id}')" 
                    title="Ответить" ${suggestion.answered ? 'disabled' : ''}>
                <i class="fas fa-reply"></i>
            </button>
            <button class="btn-icon" onclick="toggleReadStatus('${suggestion.id}')" 
                    title="${suggestion.read ? 'Пометить непрочитанным' : 'Пометить прочитанным'}">
                <i class="fas ${suggestion.read ? 'fa-envelope' : 'fa-check'}"></i>
            </button>
            <button class="btn-icon danger" onclick="deleteSuggestion('${suggestion.id}')" 
                    title="Удалить">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        ${suggestion.answered ? '<div class="answered-badge"><i class="fas fa-check-circle"></i> Ответ отправлен</div>' : ''}
    `;
    
    return div;
}

async function replyToSuggestion(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;
    
    currentReplySuggestion = suggestion;
    
    // Заполняем модальное окно
    document.getElementById('originalMessage').innerHTML = `
        <strong>${suggestion.userName || 'Аноним'}:</strong><br>
        ${suggestion.message || 'Нет текста'}
    `;
    
    // Настраиваем форму
    document.getElementById('sendType').value = 'user';
    document.getElementById('userId').value = suggestion.userId || '';
    document.getElementById('messageText').value = `Уважаемый ${suggestion.userName || 'пользователь'}!\n\n`;
    
    // Показываем модальное окно
    document.getElementById('replyModal').style.display = 'flex';
}

function closeReplyModal() {
    document.getElementById('replyModal').style.display = 'none';
    currentReplySuggestion = null;
    document.getElementById('replyText').value = '';
}

async function sendReply() {
    if (!currentReplySuggestion) return;
    
    const replyText = document.getElementById('replyText').value.trim();
    if (!replyText) {
        showStatus('❌ Введите текст ответа', 'error');
        return;
    }
    
    // Отправляем ответ
    await sendToUser(currentReplySuggestion.userId, replyText);
    
    // Обновляем статус предложения
    if (db) {
        try {
            await db.collection('suggestions').doc(currentReplySuggestion.id).update({
                answered: true,
                answer: replyText,
                answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
                read: true
            });
        } catch (error) {
            console.error('Ошибка обновления:', error);
        }
    }
    
    closeReplyModal();
    showStatus('✅ Ответ отправлен и сохранён', 'success');
}

async function toggleReadStatus(suggestionId) {
    if (!db) return;
    
    try {
        const suggestion = allSuggestions.find(s => s.id === suggestionId);
        if (!suggestion) return;
        
        await db.collection('suggestions').doc(suggestionId).update({
            read: !suggestion.read,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        console.error('Ошибка обновления:', error);
        showStatus('❌ Ошибка обновления', 'error');
    }
}

async function deleteSuggestion(suggestionId) {
    if (!confirm('Удалить это предложение?')) return;
    
    if (!db) return;
    
    try {
        await db.collection('suggestions').doc(suggestionId).delete();
        showStatus('✅ Предложение удалено', 'success');
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showStatus('❌ Ошибка удаления', 'error');
    }
}

// ===== ФИЛЬТРАЦИЯ И ПАГИНАЦИЯ =====
function filterSuggestions(filter) {
    currentFilter = filter;
    currentPage = 1;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    updateSuggestionsUI();
}

function updatePagination(total) {
    const totalPages = Math.ceil(total / pageSize);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateSuggestionsUI();
    }
}

function nextPage() {
    const filtered = getFilteredSuggestions();
    const totalPages = Math.ceil(filtered.length / pageSize);
    
    if (currentPage < totalPages) {
        currentPage++;
        updateSuggestionsUI();
    }
}

function getFilteredSuggestions() {
    if (currentFilter === 'new') {
        return allSuggestions.filter(s => !s.read);
    } else if (currentFilter === 'answered') {
        return allSuggestions.filter(s => s.answered);
    }
    return allSuggestions;
}

// ===== СТАТИСТИКА =====
function updateStats() {
    if (!allSuggestions) return;
    
    const total = allSuggestions.length;
    const newCount = allSuggestions.filter(s => !s.read).length;
    const todayCount = allSuggestions.filter(s => {
        if (!s.timestamp) return false;
        const date = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
        return date.toDateString() === new Date().toDateString();
    }).length;
    
    // Уникальные пользователи
    const uniqueUsers = new Set(allSuggestions.map(s => s.userId).filter(id => id));
    
    document.getElementById('totalSuggestions').textContent = total;
    document.getElementById('newSuggestions').textContent = newCount;
    document.getElementById('todaySuggestions').textContent = todayCount;
    document.getElementById('usersCount').textContent = uniqueUsers.size;
    document.getElementById('dbCount').textContent = total;
}

function loadLocalStats() {
    messagesSent = parseInt(localStorage.getItem('messages_sent') || '0');
    document.getElementById('sentCount').textContent = messagesSent;
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU');
    document.getElementById('lastUpdate').textContent = timeStr;
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function updateRecipientField() {
    const sendType = document.getElementById('sendType').value;
    const group = document.getElementById('recipientGroup');
    
    if (sendType === 'user' || sendType === 'test') {
        group.style.display = 'block';
    } else {
        group.style.display = 'none';
    }
}

function updateCharCount() {
    const text = document.getElementById('messageText').value;
    const count = text.length;
    document.getElementById('charCount').textContent = count;
    
    // Подсветка
    const counter = document.getElementById('charCount');
    if (count > 4000) {
        counter.style.color = '#ef4444';
        counter.style.fontWeight = 'bold';
    } else if (count > 3500) {
        counter.style.color = '#f59e0b';
        counter.style.fontWeight = 'bold';
    } else {
        counter.style.color = '';
        counter.style.fontWeight = '';
    }
}

function formatText(type) {
    const textarea = document.getElementById('messageText');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    
    let formatted = '';
    switch(type) {
        case 'bold':
            formatted = `<b>${selected}</b>`;
            break;
        case 'italic':
            formatted = `<i>${selected}</i>`;
            break;
        case 'code':
            formatted = `<code>${selected}</code>`;
            break;
    }
    
    if (formatted) {
        textarea.value = textarea.value.substring(0, start) + 
                        formatted + 
                        textarea.value.substring(end);
        updateCharCount();
    }
}

function addTemplate() {
    const templates = [
        'Спасибо за ваше предложение! Мы его рассмотрим.',
        'Ваше предложение принято в работу.',
        'Благодарим за обратную связь!',
        'Мы получили ваше предложение и изучаем его.',
        'Спасибо за идею! Мы добавим её в план.'
    ];
    
    const random = templates[Math.floor(Math.random() * templates.length)];
    const textarea = document.getElementById('messageText');
    
    if (textarea.value && !textarea.value.endsWith('\n\n')) {
        textarea.value += '\n\n' + random;
    } else {
        textarea.value += random;
    }
    
    updateCharCount();
}

function previewMessage() {
    const message = document.getElementById('messageText').value;
    if (!message) {
        showStatus('❌ Нет текста для предпросмотра', 'error');
        return;
    }
    
    alert(`📝 Предпросмотр сообщения:\n\n${message}\n\n👉 HTML-теги будут отображаться в Telegram`);
}

function clearForm() {
    document.getElementById('messageText').value = '';
    document.getElementById('userId').value = '';
    document.getElementById('replyText').value = '';
    updateCharCount();
}

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU');
    const dateStr = now.toLocaleDateString('ru-RU');
    
    // Можно добавить отображение времени где-нибудь
}

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ =====
function refreshSuggestions() {
    loadFirebaseData();
    showStatus('🔄 Обновление данных...', 'info');
    setTimeout(() => showStatus('✅ Данные обновлены', 'success'), 1000);
}

async function exportData() {
    if (allSuggestions.length === 0) {
        showStatus('❌ Нет данных для экспорта', 'error');
        return;
    }
    
    showStatus('📊 Подготовка экспорта...', 'info');
    
    // Формируем CSV
    let csv = 'ID,Пользователь,Telegram ID,Сообщение,Дата,Прочитано,С ответом\n';
    
    allSuggestions.forEach(suggestion => {
        const date = suggestion.timestamp 
            ? (suggestion.timestamp.toDate ? suggestion.timestamp.toDate().toLocaleString('ru-RU') : suggestion.timestamp)
            : 'Неизвестно';
        
        const row = [
            suggestion.id,
            `"${(suggestion.userName || 'Аноним').replace(/"/g, '""')}"`,
            suggestion.userId || '',
            `"${((suggestion.message || '').replace(/"/g, '""'))}"`,
            date,
            suggestion.read ? 'Да' : 'Нет',
            suggestion.answered ? 'Да' : 'Нет'
        ].join(',');
        
        csv += row + '\n';
    });
    
    // Создаём и скачиваем файл
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `предложения_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('✅ Данные экспортированы в CSV', 'success');
}

async function sendTestToAll() {
    if (!confirm('Отправить тестовое сообщение всем пользователям?')) return;
    
    const testMessage = '🔔 *Тестовое сообщение от администратора*\n\nЭто тестовое сообщение для проверки работы системы рассылки.';
    
    await sendBroadcast(testMessage);
}

async function markAllAsRead() {
    if (!db || allSuggestions.length === 0) return;
    
    if (!confirm('Пометить все предложения как прочитанные?')) return;
    
    showStatus('📨 Обработка...', 'info');
    
    try {
        const batch = db.batch();
        const unread = allSuggestions.filter(s => !s.read);
        
        unread.forEach(suggestion => {
            const ref = db.collection('suggestions').doc(suggestion.id);
            batch.update(ref, {
                read: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        showStatus(`✅ Помечено ${unread.length} предложений`, 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showStatus('❌ Ошибка обновления', 'error');
    }
}

async function clearDatabase() {
    if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ предложения из базы. Продолжить?')) return;
    
    if (!db) return;
    
    showStatus('🗑️ Удаление...', 'info');
    
    try {
        const batch = db.batch();
        const snapshot = await db.collection('suggestions').get();
        
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        showStatus('✅ База данных очищена', 'success');
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showStatus('❌ Ошибка удаления', 'error');
    }
}

async function saveToHistory(userId, message) {
    if (!db) return;
    
    try {
        await db.collection('messages').add({
            userId: userId,
            message: message.substring(0, 200),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'outgoing'
        });
    } catch (error) {
        console.error('Ошибка сохранения истории:', error);
    }
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('messageStatus');
    statusEl.className = `status-message show ${type}`;
    statusEl.innerHTML = message;
    
    if (type !== 'info') {
        setTimeout(() => {
            statusEl.className = 'status-message';
            statusEl.innerHTML = '';
        }, 3000);
    }
}

// ===== ГОТОВО! =====
console.log('✨ Система бота-предложки готова к работе!');
