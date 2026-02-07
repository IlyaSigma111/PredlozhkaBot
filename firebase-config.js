// firebase-config.js
// Конфигурация вашего Firebase проекта

const firebaseConfig = {
    apiKey: "AIzaSyB5l0kA2rLyEy21zsosJTU0M_vxJHS5Qpk",
    authDomain: "predlozhkabot.firebaseapp.com",
    databaseURL: "https://predlozhkabot-default-rtdb.firebaseio.com",
    projectId: "predlozhkabot",
    storageBucket: "predlozhkabot.firebasestorage.app",
    messagingSenderId: "869552257549",
    appId: "1:869552257549:web:d2c0569096aa8ebe78b344"
};

// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase успешно инициализирован");
    
    // Получаем Firestore
    const db = firebase.firestore();
    
    // Экспортируем для использования в других файлах
    window.firebaseApp = firebase.app();
    window.firebaseDB = db;
    window.firebaseAuth = firebase.auth();
    
    // Устанавливаем настройки Firestore
    db.settings({
        timestampsInSnapshots: true
    });
    
    console.log("Firestore готов к использованию");
    
} catch (error) {
    console.error("Ошибка инициализации Firebase:", error);
}

// Функция для получения текущего пользователя (админа)
function getCurrentUser() {
    return new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                resolve(user);
            } else {
                // Если нет пользователя, создаём анонимного
                firebase.auth().signInAnonymously()
                    .then((userCredential) => {
                        resolve(userCredential.user);
                    })
                    .catch((error) => {
                        console.error("Ошибка анонимной авторизации:", error);
                        reject(error);
                    });
            }
        });
    });
}
