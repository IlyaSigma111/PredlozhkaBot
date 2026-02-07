// ===== КОНСТАНТЫ И КОНФИГУРАЦИЯ =====
const BOT_TOKEN = '8597583917:AAFPOQqsJSe8vAxP0Af8VEEQwgKYH3iogT8';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let botOnline = false;
let messagesSent = 0;
let db = null;
let currentPage = 1;
const pageSize = 10;
let currentFilter = 'all';
let currentReplySuggestion = null;
let allSuggestions = [];

// ===== DEMO ДАННЫЕ (если Firebase не работает) =====
const DEMO_SUGGESTIONS = [
    {
        id: '1',
        userId: '123456789',
        userName: 'Иван Петров',
        message: 'Предлагаю добавить темную тему на сайте. Сейчас белый фон слишком яркий.',
        timestamp: new Date(Date.now() - 3600000),
        read: false,
        answered: false
    },
    {
        id: '2',
        userId: '987654321',
        userName: 'Анна Сидорова',
        message: 'Можно сделать мобильную версию удобнее? Сейчас на телефоне неудобно пользоваться.',
        timestamp: new Date(Date.now() - 7200000),
        read: true,
        answered: true
    },
    {
        id: '3',
        userId: '555666777',
        userName: 'Сергей Иванов',
        message: 'Нашел баг: при отправке формы не очищаются поля после успешной отправки.',
        timestamp: new Date(Date.now() - 86400000),
        read: false,
        answered: false
    },
    {
        id: '4',
        userId: '888999000',
        userName: 'Мария Козлова',
        message: 'Хотелось бы видеть больше статистики по предложениям. Сколько всего принято, сколько в работе и т.д.',
        timestamp: new Date(Date.now() - 172800000),
        read: true,
        answered: false
    },
    {
        id: '5',
        userId: '111222333',
        userName: 'Алексей Смирнов',
        message: 'Предлагаю добавить возможность прикрепления скриншотов к предложениям.',
        timestamp: new Date(Date.now() - 259200000),
        read: true,
        answered: true
    }
];

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Бот-предложка инициализирован');
    
    try {
        // Пробуем инициализировать Firebase
        initializeFirebase();
        
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
        
        // Загружаем данные
        loadData();
        
        // Инициализируем раз в секунду (для теста)
        setInterval(() => {
            updateStats();
            updateLastUpdateTime();
        }, 1000);
        
        showStatus('✅ Система загружена и готова к работе!', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        // Используем демо-данные
        useDemoData();
        showStatus('⚠️ Используются демо-данные. Firebase недоступен.', 'warning');
    }
});

// ===== УПРОЩЕННЫЙ FIREBASE =====
function initializeFirebase() {
    try {
        // Проверяем, загружена ли библиотека Firebase
        if (typeof firebase === 'undefined') {
            console.warn('Firebase не загружен. Используем демо-данные.');
            useDemoData();
            return;
        }
        
        // Конфигурация Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyB5l0kA2rLyEy21zsosJTU0M_vxJHS5Qpk",
            authDomain: "predlozhkabot.firebaseapp.com",
            projectId: "predlozhkabot",
            storageBucket: "predlozhkabot.firebasestorage.app",
            messagingSenderId: "869552257549",
            appId: "1:869552257549:web:d2c0569096aa8ebe78b344"
        };
        
        // Инициализируем Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        
        console.log('✅ Firebase инициализирован');
        updateFirebaseStatus(true);
        
    } catch (error) {
        console.warn('⚠️ Не удалось инициализировать Firebase:', error);
        updateFirebaseStatus(false);
        useDemoData();
    }
}

function updateFirebaseStatus(connected) {
    const statusEl = document.getElementById('firebaseStatusText');
    if (statusEl) {
        if (connected) {
            statusEl.textContent = 'Подключено';
            statusEl.style.color = '#10b981';
        } else {
            statusEl.textContent = 'Не подключено';
            statusEl.style.color = '#ef4444';
        }
    }
}

function loadData() {
    if (db) {
        // Пробуем загрузить из Firebase
        loadFromFirebase();
    } else {
        // Используем демо-данные
        useDemoData();
    }
}

async function loadFromFirebase() {
    if (!db) {
        useDemoData();
        return;
    }
    
    try {
        const snapshot = await db.collection('suggestions').get();
        allSuggestions = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            allSuggestions.push({
                id: doc.id,
                ...data
            });
        });
        
        console.log(`✅ Загружено ${allSuggestions.length} предложений из Firebase`);
        updateSuggestionsUI();
        updateStats();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки из Firebase:', error);
        useDemoData();
    }
}

function useDemoData() {
    console.log('📊 Используем демо-данные');
    allSuggestions = DEMO_SUGGESTIONS;
    updateSuggestionsUI();
    updateStats();
    updateFirebaseStatus(false);
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
        showStatus('⚠️ Бот недоступен. Проверьте токен.', 'warning');
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
        // Для теста используем первого пользователя из базы
        if (allSuggestions.length > 0) {
            const testId = allSuggestions[0].userId;
            await sendToUser(testId, '🔔 Тестовое сообщение: ' + message);
        } else {
            showStatus('❌ Нет пользователей для теста', 'error');
        }
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
        showStatus('❌ Ошибка сети при отправке', 'error');
    }
}

async function sendBroadcast(message) {
    if (allSuggestions.length === 0) {
        showStatus('❌ Нет пользователей для рассылки', 'error');
        return;
    }
    
    // Получаем уникальных пользователей
    const users = [...new Set(allSuggestions.map(s => s.userId).filter(id => id))];
    
    if (users.length === 0) {
        showStatus('❌ Нет пользователей в базе', 'error');
        return;
    }
    
    if (!confirm(`Отправить сообщение ${users.length} пользователям?`)) return;
    
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
            } else {
                failed++;
            }
            
            // Небольшая задержка между сообщениями
            await new Promise(resolve => setTimeout(resolve, 100));
            
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
        const date = suggestion.timestamp instanceof Date ? suggestion.timestamp : new Date(suggestion.timestamp);
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
    if (db && currentReplySuggestion.id) {
        try {
            await db.collection('suggestions').doc(currentReplySuggestion.id).update({
                answered: true,
                answer: replyText,
                answeredAt: new Date(),
                read: true
            });
            
            // Обновляем локальные данные
            const index = allSuggestions.findIndex(s => s.id === currentReplySuggestion.id);
            if (index !== -1) {
                allSuggestions[index].answered = true;
                allSuggestions[index].read = true;
                updateSuggestionsUI();
            }
            
        } catch (error) {
            console.error('Ошибка обновления в Firebase:', error);
        }
    } else {
        // Обновляем демо-данные
        const index = allSuggestions.findIndex(s => s.id === currentReplySuggestion.id);
        if (index !== -1) {
            allSuggestions[index].answered = true;
            allSuggestions[index].read = true;
            updateSuggestionsUI();
        }
    }
    
    closeReplyModal();
    showStatus('✅ Ответ отправлен', 'success');
}

async function toggleReadStatus(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;
    
    // Обновляем локально
    suggestion.read = !suggestion.read;
    
    // Обновляем в Firebase если есть подключение
    if (db) {
        try {
            await db.collection('suggestions').doc(suggestionId).update({
                read: suggestion.read,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Ошибка обновления в Firebase:', error);
        }
    }
    
    updateSuggestionsUI();
    updateStats();
}

async function deleteSuggestion(suggestionId) {
    if (!confirm('Удалить это предложение?')) return;
    
    // Удаляем локально
    allSuggestions = allSuggestions.filter(s => s.id !== suggestionId);
    
    // Удаляем из Firebase если есть подключение
    if (db) {
        try {
            await db.collection('suggestions').doc(suggestionId).delete();
        } catch (error) {
            console.error('Ошибка удаления из Firebase:', error);
        }
    }
    
    updateSuggestionsUI();
    updateStats();
    showStatus('✅ Предложение удалено', 'success');
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
    
    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
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
        const date = s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp);
        return date.toDateString() === new Date().toDateString();
    }).length;
    
    // Уникальные пользователи
    const uniqueUsers = new Set(allSuggestions.map(s => s.userId).filter(id => id));
    
    // Обновляем UI
    const totalEl = document.getElementById('totalSuggestions');
    const newEl = document.getElementById('newSuggestions');
    const todayEl = document.getElementById('todaySuggestions');
    const usersEl = document.getElementById('usersCount');
    const dbEl = document.getElementById('dbCount');
    
    if (totalEl) totalEl.textContent = total;
    if (newEl) newEl.textContent = newCount;
    if (todayEl) todayEl.textContent = todayCount;
    if (usersEl) usersEl.textContent = uniqueUsers.size;
    if (dbEl) dbEl.textContent = total;
}

function loadLocalStats() {
    messagesSent = parseInt(localStorage.getItem('messages_sent') || '0');
    const sentEl = document.getElementById('sentCount');
    if (sentEl) sentEl.textContent = messagesSent;
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU');
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = timeStr;
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function updateRecipientField() {
    const sendType = document.getElementById('sendType');
    const group = document.getElementById('recipientGroup');
    
    if (sendType && group) {
        if (sendType.value === 'user' || sendType.value === 'test') {
            group.style.display = 'block';
        } else {
            group.style.display = 'none';
        }
    }
}

function updateCharCount() {
    const textarea = document.getElementById('messageText');
    if (!textarea) return;
    
    const text = textarea.value;
    const count = text.length;
    const counter = document.getElementById('charCount');
    
    if (counter) {
        counter.textContent = count;
        
        // Подсветка
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
}

function formatText(type) {
    const textarea = document.getElementById('messageText');
    if (!textarea) return;
    
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
    
    if (textarea) {
        if (textarea.value && !textarea.value.endsWith('\n\n')) {
            textarea.value += '\n\n' + random;
        } else {
            textarea.value += random;
        }
        
        updateCharCount();
    }
}

function previewMessage() {
    const textarea = document.getElementById('messageText');
    if (!textarea) return;
    
    const message = textarea.value;
    if (!message) {
        showStatus('❌ Нет текста для предпросмотра', 'error');
        return;
    }
    
    alert(`📝 Предпросмотр сообщения:\n\n${message}\n\n👉 HTML-теги будут отображаться в Telegram`);
}

function clearForm() {
    const messageText = document.getElementById('messageText');
    const userId = document.getElementById('userId');
    const replyText = document.getElementById('replyText');
    
    if (messageText) messageText.value = '';
    if (userId) userId.value = '';
    if (replyText) replyText.value = '';
    
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
    if (db) {
        loadFromFirebase();
    }
    showStatus('🔄 Обновление данных...', 'info');
    setTimeout(() => showStatus('✅ Данные обновлены', 'success'), 1000);
}

function exportData() {
    if (allSuggestions.length === 0) {
        showStatus('❌ Нет данных для экспорта', 'error');
        return;
    }
    
    showStatus('📊 Подготовка экспорта...', 'info');
    
    // Формируем CSV
    let csv = 'ID,Пользователь,Telegram ID,Сообщение,Дата,Прочитано,С ответом\n';
    
    allSuggestions.forEach(suggestion => {
        const date = suggestion.timestamp 
            ? (suggestion.timestamp instanceof Date ? suggestion.timestamp.toLocaleString('ru-RU') : new Date(suggestion.timestamp).toLocaleString('ru-RU'))
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

function sendTestToAll() {
    if (!confirm('Отправить тестовое сообщение всем пользователям?')) return;
    
    const testMessage = '🔔 *Тестовое сообщение от администратора*\n\nЭто тестовое сообщение для проверки работы системы рассылки.';
    
    sendBroadcast(testMessage);
}

function markAllAsRead() {
    if (allSuggestions.length === 0) return;
    
    if (!confirm('Пометить все предложения как прочитанные?')) return;
    
    showStatus('📨 Обработка...', 'info');
    
    // Обновляем локально
    allSuggestions.forEach(suggestion => {
        suggestion.read = true;
    });
    
    // Обновляем в Firebase если есть подключение
    if (db) {
        // В реальном приложении здесь будет batch update
        showStatus('✅ Помечено как прочитанное (локально)', 'success');
    } else {
        showStatus('✅ Помечено как прочитанное', 'success');
    }
    
    updateSuggestionsUI();
    updateStats();
}

function clearDatabase() {
    if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ предложения. Продолжить?')) return;
    
    showStatus('🗑️ Удаление...', 'info');
    
    // Очищаем локальные данные
    allSuggestions = [];
    
    // Очищаем Firebase если есть подключение
    if (db) {
        // В реальном приложении здесь будет удаление из Firebase
        showStatus('✅ База данных очищена (локально)', 'success');
    } else {
        showStatus('✅ База данных очищена', 'success');
    }
    
    updateSuggestionsUI();
    updateStats();
}

async function saveToHistory(userId, message) {
    if (db) {
        try {
            await db.collection('messages').add({
                userId: userId,
                message: message.substring(0, 200),
                timestamp: new Date(),
                type: 'outgoing'
            });
        } catch (error) {
            console.error('Ошибка сохранения истории:', error);
        }
    }
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('messageStatus');
    if (!statusEl) return;
    
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
