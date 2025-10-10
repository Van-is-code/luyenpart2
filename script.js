document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const levelSelectionScreen = document.getElementById('level-selection-screen');
    const practiceScreen = document.getElementById('practice-screen');
    // Only select buttons that have a data-level attribute (exclude the summary button)
    const levelButtons = document.querySelectorAll('.level-btn[data-level]');
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
    const correctTranslationEl = document.getElementById('correct-translation');
    const vietnameseTranslationEl = document.getElementById('vietnamese-translation');
    const translationScoreEl = document.getElementById('translation-score');
    const skipBtn = document.getElementById('skip-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const aiHelperBtn = document.getElementById('ai-helper-btn');
    const aiExplanationEl = document.getElementById('ai-explanation');

    // --- State Management ---
    let allData = {};
    let currentSentences = [];
    let currentSentenceIndex = 0;
    const COMPLETION_THRESHOLD = 0.9; // 90%
    let isPronunciationCorrect = false;
    let isTranslationCorrect = false;

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
            // enable level buttons and summary button after data loaded
            enableSelectionButtons();
        } catch (error) {
            alert("Lỗi tải dữ liệu. Hãy chắc chắn file data.json tồn tại và đúng cấu trúc.");
        }
    }

    function enableSelectionButtons() {
        levelButtons.forEach(b => b.removeAttribute('disabled'));
        const summary = document.getElementById('summary-mode-btn');
        if (summary) summary.removeAttribute('disabled');
    }

    function disableSelectionButtons() {
        levelButtons.forEach(b => b.setAttribute('disabled', 'true'));
        const summary = document.getElementById('summary-mode-btn');
        if (summary) summary.setAttribute('disabled', 'true');
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

    function startLevel(level) {
        const levelKey = `level${level}`;
        if (!allData[levelKey] || allData[levelKey].length === 0) {
            alert(`Không có dữ liệu cho Level ${level}!`);
            return;
        }
        // Shuffle sentences for this level so order is random each time
        currentSentences = shuffleArray(allData[levelKey]);
        currentSentenceIndex = 0;
        
        levelSelectionScreen.classList.add('hidden');
        practiceScreen.classList.remove('hidden');
        practiceHeader.textContent = `Level ${level}`;
        
        displaySentence();
    }

    // --- Summary mode: combine all sentences and shuffle (intended for all 125 sentences)
    function startSummaryMode() {
        // Combine all level arrays into one
        const combined = [];
        Object.keys(allData).forEach(k => {
            if (Array.isArray(allData[k])) combined.push(...allData[k]);
        });
        if (combined.length === 0) {
            alert('Chưa có dữ liệu để tổng kết. Vui lòng tải dữ liệu trước.');
            return;
        }

        currentSentences = shuffleArray(combined);
        currentSentenceIndex = 0;

        levelSelectionScreen.classList.add('hidden');
        practiceScreen.classList.remove('hidden');
    // Show fixed summary count (125) per user's request
    practiceHeader.textContent = `Tổng kết: 125 câu`;

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
    }

    function showAnswers() {
        answerSectionEl.classList.remove('hidden');
        correctTranslationEl.parentElement.parentElement.classList.remove('hidden');
        // populate the Vietnamese translation under the sentence (if available)
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
        
        // TODO: Thay thế URL này bằng endpoint backend của bạn
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
    levelButtons.forEach(button => {
        button.addEventListener('click', () => startLevel(button.dataset.level));
    });

    // Summary mode button
    const summaryModeBtn = document.getElementById('summary-mode-btn');
    if (summaryModeBtn) summaryModeBtn.addEventListener('click', startSummaryMode);

    backToLevelsBtn.addEventListener('click', () => {
        practiceScreen.classList.add('hidden');
        levelSelectionScreen.classList.remove('hidden');
    });
    
    aiHelperBtn.addEventListener('click', getAIGrammarExplanation);
    playAudioBtn.addEventListener('click', () => playAudio(false));
    skipBtn.addEventListener('click', showAnswers);

    checkTranslationBtn.addEventListener('click', () => {
        try {
            // Ensure we have a sentence loaded
            const current = currentSentences[currentSentenceIndex];
            if (!current) {
                translationScoreEl.textContent = 'Hãy chọn một level và câu trước khi kiểm tra.';
                translationScoreEl.style.color = 'red';
                return;
            }

            const userTranslation = (translationInputEl.value || '').trim();
            if (!userTranslation) {
                translationScoreEl.textContent = 'Vui lòng nhập bản dịch của bạn.';
                translationScoreEl.style.color = 'red';
                return;
            }

            const correctTrans = current.translation || '';
            const score = calculateSimilarity(userTranslation.toLowerCase(), correctTrans.toLowerCase());

            translationScoreEl.textContent = `Điểm: ${(score * 100).toFixed(0)}%`;
            translationScoreEl.style.color = score >= COMPLETION_THRESHOLD ? 'green' : (score > 0.6 ? 'orange' : 'red');

            // Reveal the correct translation area so the user can compare
            try {
                // correctTranslationEl is inside a <p>, which is inside the .translation-result div
                if (correctTranslationEl && correctTranslationEl.parentElement && correctTranslationEl.parentElement.parentElement) {
                    correctTranslationEl.parentElement.parentElement.classList.remove('hidden');
                }
            } catch (e) { /* ignore DOM errors */ }

            correctTranslationEl.textContent = correctTrans;

            if (score >= COMPLETION_THRESHOLD) {
                isTranslationCorrect = true;
                checkCompletion();
            } else {
                isTranslationCorrect = false;
            }
        } catch (err) {
            console.error('Error during translation check:', err);
            translationScoreEl.textContent = 'Đã có lỗi khi kiểm tra. Vui lòng thử lại.';
            translationScoreEl.style.color = 'red';
        }
    });
    
    recordBtn.addEventListener('click', () => { if(recognition) recognition.start(); });

    nextBtn.addEventListener('click', () => {
        currentSentenceIndex++;
        if (currentSentenceIndex >= currentSentences.length) {
            alert('Chúc mừng! Bạn đã hoàn thành level này!');
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
    function playAudio(autoplay = false) {
        if (synth.speaking) synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(currentSentences[currentSentenceIndex].sentence);
        utterance.lang = 'en-US';
        
        if (synth.getVoices().length === 0) {
             synth.onvoiceschanged = () => synth.speak(utterance);
        } else {
            synth.speak(utterance);
        }
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
    // disable selection until data is loaded
    disableSelectionButtons();
    loadData();
});