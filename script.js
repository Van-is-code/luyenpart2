document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const levelSelectionScreen = document.getElementById('level-selection-screen');
    const practiceScreen = document.getElementById('practice-screen');
    
    // Nút duy nhất để bắt đầu
    const startBtvn10Btn = document.getElementById('start-btvn10-btn'); 
    
    const backToLevelsBtn = document.getElementById('back-to-levels-btn');
    const practiceHeader = document.getElementById('practice-header');
    const progressText = document.getElementById('progress-text');
    
    const answerSectionEl = document.getElementById('answer-section');
    const sentenceTextEl = document.getElementById('sentence-text');
    const ipaTextEl = document.getElementById('ipa-text');
    const playAudioBtn = document.getElementById('play-audio-btn');
    const recordBtn = document.getElementById('record-btn');
    const recognitionResultEl = document.getElementById('recognition-result');
    const pronunciationScoreEl = document.getElementById('pronunciation-score');
    const translationInputEl = document.getElementById('translation-input');
    const checkTranslationBtn = document.getElementById('check-translation-btn');
    // Translation mode UI
    const translationModeRecordBtn = document.getElementById('translation-mode-record');
    const translationModeTypeBtn = document.getElementById('translation-mode-type');
    const translationRecordSection = document.getElementById('translation-record-section');
    const translationTypeSection = document.getElementById('translation-type-section');
    const recordTranslationBtn = document.getElementById('record-translation-btn');
    const translationRecordResultEl = document.getElementById('translation-record-result');
    const correctTranslationEl = document.getElementById('correct-translation');
    const vietnameseTranslationEl = document.getElementById('vietnamese-translation');
    const translationScoreEl = document.getElementById('translation-score');
    const skipBtn = document.getElementById('skip-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const aiHelperBtn = document.getElementById('ai-helper-btn');
    const aiExplanationEl = document.getElementById('ai-explanation');

    // --- State Management ---
    let allData = {}; // Sẽ chỉ lưu { btvn10: [...] }
    let currentSentences = []; // Danh sách 25 câu
    let currentSentenceIndex = 0;
    const COMPLETION_THRESHOLD = 0.9; // 90%
    let isPronunciationCorrect = false;
    let isTranslationCorrect = false;
    let translationMode = 'type'; // 'type' or 'record'
    let isRecordingTranslation = false;
    let preferredVoice = null; // Để lưu giọng đọc tốt nhất

    // --- AI Integration ---
    const synth = window.speechSynthesis;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
    }

    // --- Core Logic ---
    async function loadData() {
        try {
            const response = await fetch('data.json');
            allData = await response.json();
            enableSelectionButtons();
        } catch (error) {
            alert("Lỗi tải dữ liệu. Hãy chắc chắn file data.json tồn tại và đúng cấu trúc.");
        }
    }

    // *** HÀM ĐÃ CẬP NHẬT: Ưu tiên giọng NỮ ***
    function loadSpeechVoices() {
        if (!synth) return;
        
        const setVoice = () => {
            const voices = synth.getVoices();
            if (voices.length === 0) return;

            // 1. Ưu tiên giọng "Natural" NỮ (VD: Microsoft Zira, Aria)
            // preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Natural') && v.name.includes('Female')) ||
                             // 2. Ưu tiên giọng "Google" NỮ
                             voices.find(v => v.lang === 'en-US' && v.name.includes('Google') && v.name.includes('Female')) ||
                             // 3. Ưu tiên bất kỳ giọng "Female" (Nữ) nào
                            //  voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
                            //  // 4. Dự phòng: Lấy giọng Natural bất kỳ (Nam/Nữ)
                            //  voices.find(v => v.lang === 'en-US' && v.name.includes('Natural')) ||
                            //  // 5. Dự phòng: Lấy giọng Google bất kỳ
                            //  voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                            //  // 6. Dự phòng: Lấy giọng en-US đầu tiên
                            //  voices.find(v => v.lang === 'en-US');

            console.log("Giọng đọc được chọn:", preferredVoice ? preferredVoice.name : "Không tìm thấy giọng en-US");
        };

        if (synth.getVoices().length !== 0) {
            setVoice();
        } else {
            synth.onvoiceschanged = setVoice;
        }
    }
    // *****************************************

    function enableSelectionButtons() {
        if (startBtvn10Btn) startBtvn10Btn.removeAttribute('disabled');
    }

    function disableSelectionButtons() {
        if (startBtvn10Btn) startBtvn10Btn.setAttribute('disabled', 'true');
    }

    // Fisher-Yates shuffle
    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Hàm bắt đầu luyện tập duy nhất
    function startPractice() {
        if (!allData.btvn10 || allData.btvn10.length === 0) {
            alert('Lỗi: Không tìm thấy dữ liệu btvn10 trong data.json.');
            return;
        }
        currentSentences = shuffleArray(allData.btvn10);
        currentSentenceIndex = 0;
        
        levelSelectionScreen.classList.add('hidden');
        practiceScreen.classList.remove('hidden');
        practiceHeader.textContent = `Luyện tập BTVN 10`;
        
        displaySentence();
    }

    function displaySentence() {
        if (currentSentences.length === 0) return;
        
        const currentData = currentSentences[currentSentenceIndex];
        sentenceTextEl.textContent = currentData.sentence;
        ipaTextEl.textContent = currentData.ipa;
        correctTranslationEl.textContent = currentData.translation;
        progressText.textContent = `Câu ${currentSentenceIndex + 1} / ${currentSentences.length}`;

        resetForNewSentence();
        playAudio(true);
    }
    
    function setTranslationMode(mode) {
        translationMode = mode;
        if (mode === 'type') {
            translationTypeSection.style.display = '';
            translationRecordSection.style.display = 'none';
            translationModeTypeBtn.classList.add('active');
            translationModeRecordBtn.classList.remove('active');
        } else {
            translationTypeSection.style.display = 'none';
            translationRecordSection.style.display = '';
            translationModeTypeBtn.classList.remove('active');
            translationModeRecordBtn.classList.add('active');
        }
        translationRecordResultEl.textContent = '';
        translationInputEl.value = '';
    }

    function resetForNewSentence() {
        answerSectionEl.classList.add('hidden');
        aiExplanationEl.classList.add('hidden');
        aiExplanationEl.textContent = '';
        correctTranslationEl.parentElement.parentElement.classList.add('hidden');
        if (vietnameseTranslationEl) vietnameseTranslationEl.textContent = '';
        isPronunciationCorrect = false;
        isTranslationCorrect = false;
        recognitionResultEl.textContent = '';
        pronunciationScoreEl.textContent = '';
        translationInputEl.value = '';
        translationScoreEl.textContent = '';
        nextBtn.disabled = true;
        skipBtn.disabled = false;
        setTranslationMode('type');

        if (synth.speaking) synth.cancel();
    }

    function showAnswers() {
        answerSectionEl.classList.remove('hidden');
        correctTranslationEl.parentElement.parentElement.classList.remove('hidden');
        try {
            const cur = currentSentences[currentSentenceIndex];
            if (vietnameseTranslationEl && cur && cur.translation) {
                vietnameseTranslationEl.textContent = cur.translation;
            }
        } catch (e) { /* ignore */ }
        nextBtn.disabled = false;
        skipBtn.disabled = true;
    }

    function checkCompletion() {
        if (isPronunciationCorrect && isTranslationCorrect) {
            nextBtn.disabled = false;
            skipBtn.disabled = true;
            alert('Xuất sắc! Bạn đã hoàn thành câu này. Hãy qua câu tiếp theo.');
        }
    }
    
    async function getAIGrammarExplanation() {
        const sentence = currentSentences[currentSentenceIndex].sentence;
        aiExplanationEl.textContent = '🤖 AI đang phân tích, vui lòng chờ...';
        aiExplanationEl.classList.remove('hidden');
        
        const YOUR_BACKEND_API_URL = 'http://127.0.0.1:5000/analyze-grammar';
        
        try {
             await new Promise(resolve => setTimeout(resolve, 1500));
             aiExplanationEl.innerHTML = `
                 <strong>Phân tích câu:</strong> "${sentence}"<br>
                 - Đây là phần mô phỏng. Hãy kết nối tới backend của bạn để nhận phân tích ngữ pháp từ AI.
             `;

        } catch (error) {
            aiExplanationEl.textContent = 'Rất tiếc, đã có lỗi xảy ra khi kết nối với AI.';
        }
    }

    // --- Event Listeners ---
    if (startBtvn10Btn) {
        startBtvn10Btn.addEventListener('click', startPractice);
    }

    backToLevelsBtn.addEventListener('click', () => {
        practiceScreen.classList.add('hidden');
        levelSelectionScreen.classList.remove('hidden');
    });
    
    aiHelperBtn.addEventListener('click', getAIGrammarExplanation);
    playAudioBtn.addEventListener('click', () => playAudio(false));
    skipBtn.addEventListener('click', showAnswers);

    checkTranslationBtn.addEventListener('click', () => {
        try {
            const current = currentSentences[currentSentenceIndex];
            if (!current) return;

            let userTranslation = '';
            if (translationMode === 'type') {
                userTranslation = (translationInputEl.value || '').trim();
            } else {
                userTranslation = (translationRecordResultEl.textContent || '').trim();
            }
            if (!userTranslation) {
                translationScoreEl.textContent = translationMode === 'type' ? 'Vui lòng nhập bản dịch.' : 'Vui lòng ghi âm bản dịch.';
                translationScoreEl.style.color = 'red';
                return;
            }

            const correctTrans = current.translation || '';
            const score = calculateSimilarity(userTranslation.toLowerCase(), correctTrans.toLowerCase());

            translationScoreEl.textContent = `Điểm: ${(score * 100).toFixed(0)}%`;
            translationScoreEl.style.color = score >= COMPLETION_THRESHOLD ? 'green' : (score > 0.6 ? 'orange' : 'red');

            correctTranslationEl.parentElement.parentElement.classList.remove('hidden');
            correctTranslationEl.textContent = correctTrans;

            if (score >= COMPLETION_THRESHOLD) {
                isTranslationCorrect = true;
                checkCompletion();
            } else {
                isTranslationCorrect = false;
            }
        } catch (err) {
            console.error('Error during translation check:', err);
            translationScoreEl.textContent = 'Đã có lỗi khi kiểm tra.';
            translationScoreEl.style.color = 'red';
        }
    });

    if (translationModeRecordBtn && translationModeTypeBtn) {
        translationModeRecordBtn.addEventListener('click', () => setTranslationMode('record'));
        translationModeTypeBtn.addEventListener('click', () => setTranslationMode('type'));
    }

    if (recordTranslationBtn && SpeechRecognition) {
        let translationRecognition = new SpeechRecognition();
        translationRecognition.continuous = false;
        translationRecognition.lang = 'vi-VN';
        translationRecognition.interimResults = false;

        recordTranslationBtn.addEventListener('click', () => {
            if (isRecordingTranslation) {
                try { translationRecognition.stop(); } catch (e) {}
                return;
            }
            translationRecordResultEl.textContent = '';
            isRecordingTranslation = true;
            recordTranslationBtn.classList.add('recording');
            recordTranslationBtn.innerHTML = '<i class="fas fa-stop"></i> Dừng ghi âm';
            translationRecognition.start();
        });
        translationRecognition.onresult = (event) => {
            translationRecordResultEl.textContent = event.results[0][0].transcript;
        };
        translationRecognition.onend = () => {
            isRecordingTranslation = false;
            recordTranslationBtn.classList.remove('recording');
            recordTranslationBtn.innerHTML = '<i class="fas fa-microphone"></i> Ghi âm dịch';
        };
        translationRecognition.onerror = (event) => {
            translationRecordResultEl.textContent = 'Lỗi nhận dạng: ' + event.error;
            isRecordingTranslation = false;
            recordTranslationBtn.classList.remove('recording');
            recordTranslationBtn.innerHTML = '<i class="fas fa-microphone"></i> Ghi âm dịch';
        };
    }
    
    recordBtn.addEventListener('click', () => { if(recognition) recognition.start(); });

    nextBtn.addEventListener('click', () => {
        currentSentenceIndex++;
        if (currentSentenceIndex >= currentSentences.length) {
            alert('Chúc mừng! Bạn đã hoàn thành tất cả 25 câu!');
            backToLevelsBtn.click();
            return;
        }
        displaySentence();
    });

    prevBtn.addEventListener('click', () => {
        if (currentSentenceIndex > 0) {
            currentSentenceIndex--;
            displaySentence();
        }
    });

    // --- Speech Recognition Logic ---
    if (recognition) {
        recognition.onstart = () => {
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> Dừng';
            recognitionResultEl.textContent = 'Đang nghe...';
        };
        recognition.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            recognitionResultEl.textContent = spokenText;
            const originalText = currentSentences[currentSentenceIndex].sentence.toLowerCase().replace(/[.,?]/g, '');
            const score = calculateSimilarity(spokenText.toLowerCase(), originalText);
            
            pronunciationScoreEl.textContent = `Điểm: ${(score * 100).toFixed(0)}%`;
            pronunciationScoreEl.style.color = score >= COMPLETION_THRESHOLD ? 'green' : (score > 0.6 ? 'orange' : 'red');

            if (score >= COMPLETION_THRESHOLD) {
                isPronunciationCorrect = true;
                checkCompletion();
            } else { isPronunciationCorrect = false; }
        };
        recognition.onend = () => {
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '<i class="fas fa-microphone"></i> Ghi âm';
        };
        recognition.onerror = (event) => {
            recognitionResultEl.textContent = 'Lỗi nhận dạng: ' + event.error;
        };
    }

    // --- Utility Functions ---
    
    // Hàm playAudio (sử dụng TTS)
    function playAudio(autoplay = false) {
        if (synth.speaking) synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(currentSentences[currentSentenceIndex].sentence);
        utterance.lang = 'en-US';
        
        // Gán giọng đọc nữ tốt nhất đã tìm thấy
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        synth.speak(utterance);
    }
    
    function calculateSimilarity(s1, s2) {
        let longer = s1, shorter = s2;
        if (s1.length < s2.length) { longer = s2; shorter = s1; }
        let longerLength = longer.length;
        if (longerLength === 0) return 1.0;
        return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
    }

    function editDistance(s1, s2) {
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    // --- Initialization ---
    disableSelectionButtons();
    loadSpeechVoices(); // Tải giọng đọc
    loadData(); // Tải dữ liệu
});