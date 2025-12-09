import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBo5pT38Jx41FUESPlxWTZAsdTyS_BTEwM",
  authDomain: "pizza-divina-pdv.firebaseapp.com",
  projectId: "pizza-divina-pdv",
  storageBucket: "pizza-divina-pdv.firebasestorage.app",
  messagingSenderId: "831771462448",
  appId: "1:831771462448:web:196319320c3ee041e296f5",
  measurementId: "G-WVQCVSMVTD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- CONFIGURAÇÃO AVANÇADA DO FIRESTORE ---
// Inicializa o Firestore com persistência local (Offline)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: undefined
    // Removido CACHE_SIZE_UNLIMITED para evitar erros de cota (QuotaExceededError) em alguns navegadores/dispositivos
  }),
});

// --- AUTENTICAÇÃO ANÔNIMA ---
export const auth = getAuth(app);

// Monitorar estado da autenticação para debug
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ Firebase Auth State: Conectado como", user.uid);
    } else {
        console.warn("⚠️ Firebase Auth State: Desconectado. Tentando reconectar...");
        signInAnonymously(auth).catch(e => {
            console.error("Erro ao reconectar. Verifique se o provedor 'Anonymous' está ativado no Firebase Console.", e);
        });
    }
});

signInAnonymously(auth)
  .then(() => {
    console.log("🔥 Firebase: Autenticado anonimamente com sucesso (Inicialização).");
  })
  .catch((error: any) => {
    // Tratamento de erros comuns de autenticação
    if (error.code === 'auth/configuration-not-found' || error.code === 'auth/admin-restricted-operation') {
        console.error("⚠️ ERRO CRÍTICO: O login Anônimo não está ativado no Console do Firebase.");
        console.error("Acesse Build > Authentication > Sign-in method e ative 'Anonymous'.");
    } else {
        console.error("🔥 Firebase: Erro genérico na autenticação anônima.", error.code, error.message);
    }
  });
